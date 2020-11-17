// process.env.DEBUG = "@slack/events-api:*"; // @DEBUG

import { AddressInfo } from "net";
import { SlackMessageEvent } from "./lib/SlackMessage";
import { getAll } from "./webapi-pagination";
import { UserNameLookupService } from "./UserNameLookupService";
import { DiscourseAPI, DiscourseSuccessMessage } from "./Discourse";
import { getConfiguration } from "./lib/Configuration";
import { PostBuilder } from "./PostBuilder";
import { getSlack } from "./Slack";
import { isCommand, parseCommand, removeBotnameTag } from "./lib/utils";
import { executeCommand } from "./Command";
import { promoText } from "./messages/promo";
import { fold } from "fp-ts/lib/Either";
import { helpText, noTitle, notThreadedMessage } from "./messages/help";
import { createSuccessMessage } from "./messages/post-success";
import { getDB } from "./DB";
import { getLogger } from "./lib/Log";
import chalk from "chalk";
import { IncrementalUpdater } from "./IncrementalUpdater";

require("dotenv").config();

process.on("uncaughtException", (err) => {
  console.log("err", err);
});
process.on("unhandledRejection", (err) => {
  console.log("err", err);
});

async function main() {
  const configuration = await getConfiguration();
  const log = await getLogger();
  console.log("\n");
  log.info(chalk.greenBright("***** Starting the Slack Archivist bot *****\n"));
  const db = await getDB(configuration);
  const discourseAPI = new DiscourseAPI(configuration.discourse);
  const { slackEvents, slackWeb, slackInteractive } = getSlack(
    configuration.slack
  );
  const userlookup = new UserNameLookupService(slackWeb, configuration.slack);

  const incrementalUpdater = new IncrementalUpdater({
    db,
    discourseAPI: discourseAPI,
    postBuilder: new PostBuilder({
      slackPromoMessage: promoText,
      userMap: await userlookup.getUsernameDictionary(),
      messages: [],
    }),
  });

  incrementalUpdater.start();

  // Listens to all messages - **including app mentions**
  slackEvents.on("message", async (event: SlackMessageEvent) => {
    log.info("message");
    log.info(
      `Received a message event: user ${event.user} in channel ${event.channel} says ${event.text}`
    );
    // Ignore the bot's own posts
    if (event.user === (await userlookup.getBotUserId())) {
      return;
    }
    // We need to bail here if it is an app_mention
    const { thread_ts } = event;
    if (!thread_ts) {
      return;
    }
    const archivedThread = await db.getArchivedConversation(thread_ts);
    if (archivedThread) {
      // We use a transactional outbox pattern to avoid losing anything if Discourse is 404
      db.savePendingIncrementalUpdate({
        message: `${event.user} ${event.text}`,
        user: event.user,
        thread_ts,
        event_ts: event.event_ts,
      });
    }
  });

  slackEvents.on("channel_joined", (event) => console.log(event));

  // For when someone mentions the bot in a new channel
  slackEvents.on("link_shared", (event: SlackMessageEvent) => {
    log.info(`Received link_shared event...`);
    slackWeb.channels.join({
      name: event.channel,
    });
  });

  // Greet new users with the help text in a DM
  slackEvents.on("team_join", (event) => {
    const { user } = event;
    slackWeb.chat.postMessage({
      channel: user,
      as_user: true,
      text: helpText,
    });
  });

  /** Archive a thread */
  slackEvents.on("app_mention", async (event: SlackMessageEvent) => {
    const isThreadedMessage = (event: SlackMessageEvent) => !!event.thread_ts;
    // Make sure the bot is in the channel
    slackWeb.conversations
      .join({
        channel: event.channel,
      })
      .then((result) =>
        log.info(`Join channel ${event.channel} response_metadata`, {
          meta: { ...result?.response_metadata, scopes: null },
        })
      );
    const msg = removeBotnameTag(event.text, await userlookup.getBotUserId());

    if (isCommand(msg)) {
      const command = parseCommand(msg);
      return executeCommand({
        command,
        event,
        slackWeb,
      });
    }

    const thread_ts = event.thread_ts;

    if (!thread_ts) {
      log.info("Is not a threaded message!");
      return slackWeb.chat.postEphemeral({
        user: event.user,
        channel: event.channel,
        thread_ts: event.thread_ts,
        text: notThreadedMessage,
      });
    }

    const title = msg;
    if (title.length < 1) {
      log.info("Threaded message - but no title!");
      return slackWeb.chat.postEphemeral({
        user: event.user,
        channel: event.channel,
        thread_ts: event.thread_ts,
        text: noTitle,
      });
    }
    log.info("Threaded message - Creating Discourse Post");

    const postBuilder = new PostBuilder({
      slackPromoMessage: promoText,
      userMap: await userlookup.getUsernameDictionary(),
      messages: await getAll(
        slackWeb.conversations.replies,
        {
          channel: event.channel,
          ts: thread_ts,
        },
        "messages"
      ),
    });

    const existingPostFromDb = await db.getArchivedConversation(thread_ts);

    if (existingPostFromDb) {
      const doc = existingPostFromDb;
      const existingPost = await discourseAPI.getPost(doc.url);
      if (existingPost && existingPost.status === 200) {
        return slackWeb.chat.postEphemeral({
          user: event.user,
          channel: event.channel,
          thread: thread_ts,
          text: `This is already archived at ${doc.url}.`,
        });
      } else {
        log.info(
          `The database says this was already archived, but we can't find it in Discourse`
        );
      }
    }

    /**
     * This is here as a fallback for the database. If the database is lost, we may
     * be able to detect an attempt to archive an already archived thread by seeing the
     * earlier message from the Slack Archivist saying it was archived.
     *
     * If we find one, we check the URL to see if it is actually in Discourse. It may
     * have been deleted, and a user may be attempting to re-archive it.
     */
    const existingUrlFromThread = postBuilder.hasAlreadyBeenArchived();
    if (existingUrlFromThread) {
      const existingPost = await discourseAPI.getPost(existingUrlFromThread);
      if (existingPost) {
        return slackWeb.chat.postEphemeral({
          user: event.user,
          channel: event.channel,
          thread: thread_ts,
          text: `This is already archived at ${existingUrlFromThread}.`,
        });
      } else {
        log.info(
          `There is a message in the thread saying this was already archived, but we can't find it in Discourse`
        );
      }
    }
    const discoursePost = await postBuilder.buildMarkdownPost();

    log.info("Title", { meta: title }); // @DEBUG
    log.info("Post", { meta: discoursePost }); // @DEBUG

    const res = await discourseAPI.createNewPost(title, discoursePost);
    const discoursePostFailed = (e: Error) => {
      slackWeb.chat.postEphemeral({
        user: event.user,
        channel: event.channel,
        text: `Sorry! I couldn't archive that. Discourse responded with: ${JSON.stringify(
          e.message
        )}`,
      });
    };
    const discoursePostSucceeded = (res: DiscourseSuccessMessage) => {
      slackWeb.chat.postMessage({
        channel: event.channel,
        thread_ts: thread_ts,
        text: createSuccessMessage(res.url),
      });
      db.saveArchivedConversation({
        thread_ts,
        post: discoursePost,
        title,
        url: res.url,
        baseUrl: res.baseURL,
        topic_slug: res.topic_slug,
        topic_id: res.topic_id,
      });
    };
    fold(discoursePostFailed, discoursePostSucceeded)(res);
  });

  const server = await slackEvents.start(parseInt(configuration.slack.port));

  const address = server.address();
  const port = isAddressInfo(address) ? address.port : address;

  log.info(`Listening for events on ${port}`);
}

function isAddressInfo(maybeAddressInfo): maybeAddressInfo is AddressInfo {
  return !!maybeAddressInfo?.port;
}

main();
