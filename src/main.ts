import { AddressInfo } from "net";
import { SlackMessageEvent } from "./types/SlackMessage";
import { getAll } from "./webapi-pagination";
import { UserNameLookupService } from "./UserNameLookupService";
import { DiscourseAPI } from "./Discourse";
import { configuration } from "./Configuration";
import { PostBuilder } from "./PostBuilder";
import { greetNewUser } from "./NewUser";
import { slackEvents, web } from "./Slack";

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
    // @DEBUG
    console.log(event);
    if (event.text?.includes("DM")) {
      web.chat.postMessage({
        channel: event.user,
        as_user: true,
        text: "DM from Slack Archivist",
      });
      return;
    }
    // @DEBUG
    const isThreadedMessage = (event: SlackMessageEvent) => !!event.thread_ts;
    joinChannel(event.channel);
    if (!isThreadedMessage(event)) {
      return web.chat.postMessage({
        channel: event.channel,
        thread_ts: event.thread_ts,
        text:
          "Tag me _in a thread_ with what you want as the post title, and I'll put the thread in the Forum for you.",
      });
    }

    const title = event.text.substr(12, event.text.length); // Remove the bot's name
    if (title.length < 1) {
      console.log("Threaded message - but no title!");
      return web.chat.postMessage({
        channel: event.channel,
        thread_ts: event.thread_ts,
        text:
          "Tag me with what you want as the post title, and I'll put this thread in the Forum for you.",
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
