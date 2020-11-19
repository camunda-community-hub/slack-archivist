// process.env.DEBUG = "@slack/events-api:*"; // @DEBUG

// import { AddressInfo } from "net";
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
import http from "http";
import express from "express";
import bodyParser from "body-parser";

const debug = require("debug")("main");

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
  const { slackEvents, slackWeb, slackInteractions } = getSlack(
    configuration.slack
  );
  const userlookup = new UserNameLookupService(slackWeb, configuration.slack);

  const botId = await userlookup.getBotUserId();
  const incrementalUpdater = new IncrementalUpdater({
    db,
    discourseAPI: discourseAPI,
    postBuilder: new PostBuilder({
      slackPromoMessage: promoText,
      userMap: await userlookup.getUsernameDictionary(),
      messages: [],
      botId: await userlookup.getBotUserId(),
    }),
  });

  incrementalUpdater.start();

  // Listens to all messages - **including app mentions**
  slackEvents.on("message", async (event: SlackMessageEvent) => {
    log.info("message");
    log.info(
      `Received a message event: user ${await userlookup.getUserName(
        event.user
      )} in channel #${await userlookup.getChannelName(event.channel)} says "${
        event.text
      }"`
    );
    const { thread_ts } = event;

    const isPostByBot = event.user === botId;
    const isPostToBot = event.text?.includes(`<@${botId}>`);
    const isNotAReply = !thread_ts;
    if (isPostByBot || isPostToBot || !thread_ts) {
      debug(
        `Bailing: ${JSON.stringify(
          { isPostByBot, isPostToBot, isNotAReply },
          null,
          2
        )}`
      );
      return;
    }

    const archivedThread = await db.getArchivedConversation(thread_ts);
    if (archivedThread) {
      // We use a transactional outbox pattern to avoid losing anything if Discourse is 404
      const res = await db.savePendingIncrementalUpdate({
        message: event.text,
        user: event.user,
        thread_ts,
        event_ts: event.event_ts,
      });
      log.info(`Scheduled for incremental update`);
      debug(JSON.stringify(res, null, 2));
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
  slackEvents.on("team_join", async (event) => {
    const { user } = event;
    slackWeb.chat.postMessage({
      channel: user,
      as_user: true,
      text: helpText,
    });
    log.info(
      `Sent intro DM to ${(await userlookup.getUsernameDictionary())[user]}...`
    );
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
      botId: await userlookup.getBotUserId(),
    });

    const existingPostFromDb = await db.getArchivedConversation(thread_ts);

    if (existingPostFromDb) {
      const doc = existingPostFromDb;
      const existingPost = await discourseAPI.getPost(doc.topic_id);
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

    const discoursePost = await postBuilder.buildMarkdownPost();

    log.info("Title", { meta: title }); // @DEBUG
    log.info("Post", { meta: discoursePost }); // @DEBUG

    const res = await discourseAPI.createNewPost(title, discoursePost);
    const discoursePostFailed = (e: Error) => {
      slackWeb.chat.postEphemeral({
        user: event.user,
        thread_ts: event.thread_ts,
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
      log.info("Created post in Discourse:", { meta: res });
    };
    fold(discoursePostFailed, discoursePostSucceeded)(res);
  });

  const app = express();

  // *** Plug the event adapter into the express app as middleware ***
  app.use("/action-endpoint", slackEvents.expressMiddleware());

  // https://github.com/slackapi/node-slack-sdk/blob/main/examples/express-all-interactions/server.js
  app.use("/interactive-endpoint", slackInteractions.expressMiddleware());

  app.post("/discourse", bodyParser.json(), (req, res) => {
    // topic_created <- also comes in
    const topic_destroyed =
      req.header["X-Discourse-Event"] === "topic_destroyed";
    res.status(200);
    res.send({ ok: true });
    if (topic_destroyed) {
      const topic_id = req.body?.topic?.id;
      log.info(
        `Discourse webhook: Deleting topic ${topic_destroyed} from database`
      );
      db.deleteArchivedConversationFromDiscourse(topic_id);
      // Delete this from the database
    }
  });

  const port = configuration.slack.port;
  http.createServer(app).listen(port, () => {
    log.info(`server listening on port ${port}`);
  });
}

main();
