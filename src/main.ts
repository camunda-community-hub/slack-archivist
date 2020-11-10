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

require("dotenv").config();

async function main() {
  const configuration = await getConfiguration();
  const db = getDB(configuration);
  db.info().then(console.log);
  const discourseAPI = new DiscourseAPI(configuration.discourse);
  const { slackEvents, slackWeb } = getSlack(configuration.slack);
  const userlookup = new UserNameLookupService(slackWeb, configuration.slack);

  slackEvents.on("message", (event: SlackMessageEvent) => {
    //   console.log(
    //     `Received a message event: user ${event.user} in channel ${event.channel} says ${event.text}`
    //   );
  });

  slackEvents.on("channel_joined", (event) => console.log);

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
    slackWeb.channels.join({
      name: event.channel,
    });
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
      return slackWeb.chat.postEphemeral({
        user: event.user,
        channel: event.channel,
        thread_ts: event.thread_ts,
        text: notThreadedMessage,
      });
    }

    const title = msg;
    if (title.length < 1) {
      console.log("Threaded message - but no title!");
      return slackWeb.chat.postEphemeral({
        user: event.user,
        channel: event.channel,
        thread_ts: event.thread_ts,
        text: noTitle,
      });
    }
    console.log("Threaded message - Creating Discourse Post");

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

    const existingUrl = postBuilder.hasAlreadyBeenArchived();
    if (existingUrl) {
      const existingPost = await discourseAPI.getPost(existingUrl);
      if (existingPost) {
        return slackWeb.chat.postEphemeral({
          user: event.user,
          channel: event.channel,
          thread: event.thread_ts,
          text: `This is already archived at ${existingUrl}.`,
        });
      } else {
        // We saw a message from Slack Archivist saying it was already archived, but the post was not
        // found in Discourse - this means it was probably deleted from Discourse
        // We need to remove the sync record from the database
      }
    }
    const discoursePost = await postBuilder.buildMarkdownPost();

    // tslint:disable-next-line: no-console
    console.log("Title", title);
    console.log("Post", discoursePost); // @DEBUG

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
        text: createSuccessMessage(res.message),
      });
      db.put({
        _id: event.thread_ts,
        post: discoursePost,
        title,
        url: res.message,
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

  console.log(`Listening for events on ${port}`);
}

function isAddressInfo(maybeAddressInfo): maybeAddressInfo is AddressInfo {
  return !!maybeAddressInfo?.port;
}

main();
