process.env.DEBUG = "@slack/events-api:*"; // @DEBUG

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
import { v4 as uuid } from "uuid";
import { getLogger } from "./lib/Log";
import chalk from "chalk";

require("dotenv").config();

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

  // Listens to all messages - I think...
  slackEvents.on("message.channels", (event: SlackMessageEvent) => {
    log.info("message.channels");
    log.info(
      `Received a message event: user ${event.user} in channel ${event.channel} says ${event.text}`
    );
  });

  // Listens to all messages - I think...
  slackEvents.on("message", (event: SlackMessageEvent) => {
    log.info("message");
    log.info(
      `Received a message event: user ${event.user} in channel ${event.channel} says ${event.text}`
    );
  });

  slackEvents.on("channel_joined", (event) => console.log(event));

  // For when someone mentions the bot in a new channel
  slackEvents.on("link_shared", (event: SlackMessageEvent) =>
    slackWeb.channels.join({
      name: event.channel,
    })
  );

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
        log.info(`Join channel ${event.channel} result`, { meta: result })
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

    if (!isThreadedMessage(event)) {
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
          ts: event.thread_ts!,
        },
        "messages"
      ),
    });

    const op = postBuilder.getOP();
    const existingPostFromDb = await db.find({
      selector: { op: op.event_ts },
    });

    if (existingPostFromDb.docs.length > 0) {
      const existingPost = await discourseAPI.getPost(
        existingPostFromDb.docs[0].url
      );
      if (existingPost) {
        return slackWeb.chat.postEphemeral({
          user: event.user,
          channel: event.channel,
          thread: event.thread_ts,
          text: `This is already archived at ${existingPostFromDb.docs[0].url}.`,
        });
      } else {
        log.info(
          `The database says this was already archived, but we can't find it in Discourse`
        );
        // Should we delete the database record?
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
          thread: event.thread_ts,
          text: `This is already archived at ${existingUrlFromThread}.`,
        });
      } else {
        log.info(
          `There is a message in the thread saying this was already archived, but we can't find it in Discourse`
        );
      }
    }
    const discoursePost = await postBuilder.buildMarkdownPost();

    // tslint:disable-next-line: no-console
    log.info("Title", title);
    log.info("Post", discoursePost); // @DEBUG

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
        thread_ts: event.thread_ts,
        text: createSuccessMessage(res.url),
      });
      db.put({
        _id: uuid(),
        op: op.event_ts,
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
