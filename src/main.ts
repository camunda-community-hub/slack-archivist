import { AddressInfo } from "net";
import { SlackMessageEvent } from "./lib/SlackMessage";
import { getAll } from "./webapi-pagination";
import { UserNameLookupService } from "./UserNameLookupService";
import { DiscourseAPI } from "./Discourse";
import { configuration } from "./config";
import { PostBuilder } from "./PostBuilder";
import { greetNewUser } from "./NewUser";
import { slackEvents, web } from "./Slack";
import { isCommand, parseCommand, removeUsernameTag } from "./lib/utils";
import { executeCommand } from "./Command";

const discourseAPI = new DiscourseAPI(configuration.discourse);

const userlookup = new UserNameLookupService(web);

async function main() {
  const postBuilder = new PostBuilder({
    slackPromoMessage: configuration.slack.promoMessage,
    userMap: await userlookup.getUsernameDictionary(),
  });

  const serverPort = process.env.PORT || "3000";

  slackEvents.on("message", (event: SlackMessageEvent) => {
    //   console.log(
    //     `Received a message event: user ${event.user} in channel ${event.channel} says ${event.text}`
    //   );
  });

  slackEvents.on("channel_joined", (event) => console.log);

  // Greet new users
  slackEvents.on("team_join", greetNewUser);

  slackEvents.on("app_mention", async (event: SlackMessageEvent) => {
    const isThreadedMessage = (event: SlackMessageEvent) => !!event.thread_ts;
    joinChannel(event.channel);
    const msg = removeUsernameTag(event.text);

    if (isCommand(msg)) {
      const command = parseCommand(msg);
      return executeCommand({
        command,
        event,
      });
    }

    if (!isThreadedMessage(event)) {
      return web.chat.postEphemeral({
        user: event.user,
        channel: event.channel,
        thread_ts: event.thread_ts,
        text:
          "Tag me _in a threaded reply_ with what you want as the post title, and I'll put the thread in the Forum for you. If there are no replies, you can reply to the OP (your reply makes a thread) and tag me in that reply.",
      });
    }

    const title = msg;
    if (title.length < 1) {
      console.log("Threaded message - but no title!");
      return web.chat.postEphemeral({
        user: event.user,
        channel: event.channel,
        thread_ts: event.thread_ts,
        text:
          "Tag me with what you want as the post title, and I'll put this thread in the Forum for you.\n\nFor example:\n\n@archivist How do I collect the output of a multi-instance sub-process?",
      });
    }
    console.log("Threaded message - Creating Discourse Post");
    const discoursePost = await makePostFromMessagesInThread(
      event.channel,
      event.thread_ts!
    );

    const res = await discourseAPI.post(title, discoursePost);

    if (res.success) {
      return web.chat.postMessage({
        channel: event.channel,
        thread_ts: event.thread_ts,
        text: `Gosh, this _is_ an interesting conversation - I've filed a copy at ${res.url} for future reference!`,
      });
    }
    web.chat.postMessage({
      channel: event.channel,
      thread_ts: event.thread_ts,
      text: `Sorry! I couldn't archive that. Discourse responded with: ${JSON.stringify(
        res.message
      )}`,
    });
  });

  async function makePostFromMessagesInThread(
    channel: string,
    threadParent: string
  ) {
    // https://api.slack.com/methods/conversations.replies
    const messages: SlackMessageEvent[] = await getAll(
      web.conversations.replies,
      {
        channel,
        ts: threadParent,
      },
      "messages"
    );

    console.log(JSON.stringify(messages)); // debug

    // Remove the last message, because it is the call to the bot
    messages.pop();

    return postBuilder.buildMarkdownPost(messages);
  }

  // For when someone mentions the bot in a new channel
  slackEvents.on("link_shared", (event: SlackMessageEvent) =>
    joinChannel(event.channel)
  );

  function joinChannel(channel: string) {
    web.channels.join({
      name: channel,
    });
  }

  const server = await slackEvents.start(parseInt(serverPort));

  const address = server.address();
  const port = isAddressInfo(address) ? address.port : address;

  console.log(`Listening for events on ${port}`);
}

function isAddressInfo(maybeAddressInfo): maybeAddressInfo is AddressInfo {
  return !!maybeAddressInfo?.port;
}

main();
