import { createEventAdapter } from "@slack/events-api";
import { WebClient } from "@slack/web-api";
import { AddressInfo } from "net";
import { SlackMessageEvent } from "./SlackMessage";
import { getAll } from "./webapi-pagination";
import { UserNameLookupService } from "./UserNameLookupService";
import { DiscourseAPI } from "./Discourse";
import { slackPromoMessage, slackSigningSecret, token } from "./Configurator";
import { PostBuilder } from "./PostBuilder";

const slackEvents = createEventAdapter(slackSigningSecret) as any;

const discourseAPI = new DiscourseAPI();

const web = new WebClient(token);
const userlookup = new UserNameLookupService(web);
const postBuilder = new PostBuilder(slackPromoMessage);

const serverPort = process.env.PORT || "3000";

slackEvents.on("message", (event: SlackMessageEvent) => {
  //   console.log(
  //     `Received a message event: user ${event.user} in channel ${event.channel} says ${event.text}`
  //   );
});

slackEvents.on("channel_joined", event => console.log);

slackEvents.on("app_mention", async (event: SlackMessageEvent) => {
  const isThreadedMessage = (event: SlackMessageEvent) => !!event.thread_ts;
  joinChannel(event.channel);
  if (!isThreadedMessage(event)) {
    return web.chat.postMessage({
      channel: event.channel,
      thread_ts: event.thread_ts,
      text:
        "Tag me _in a thread_ with what you want as the post title, and I'll put the thread in the Forum for you."
    });
  }

  const title = event.text.substr(12, event.text.length); // Remove the bot's name
  if (title.length < 1) {
    console.log("Threaded message - but no title!");
    return web.chat.postMessage({
      channel: event.channel,
      thread_ts: event.thread_ts,
      text:
        "Tag me with what you want as the post title, and I'll put this thread in the Forum for you."
    });
  }
  console.log("Threaded message - Creating Discourse Post");
  const discoursePost = await makePostFromMessagesInThread(
    event.channel,
    event.thread_ts!
  );

  try {
    const url = await discourseAPI.post(title, discoursePost);

    web.chat.postMessage({
      channel: event.channel,
      thread_ts: event.thread_ts,
      text: `Gosh, this _is_ an interesting conversation - I've filed a copy at ${url} for future reference!`
    });
  } catch (e) {
    web.chat.postMessage({
      channel: event.channel,
      thread_ts: event.thread_ts,
      text: `Sorry! Something went wrong - please ask @Josh Wulf to take a look`
    });
    console.log(e);
  }
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
      ts: threadParent
    },
    "messages"
  );

  // Remove the last message, because it is the call to the bot
  messages.pop();

  // build a set of unique user codes in the conversation
  const users = new Set<string>();
  messages.forEach(msg => users.add(msg.user));

  // get a (cached) lookup dictionary of usercodes to usernames from Slack API
  const userMap = await userlookup.getUsernames(Array.from(users));

  return postBuilder.buildMarkdownPost(messages, userMap);
}

// For when someone mentions the bot in a new channel
slackEvents.on("link_shared", (event: SlackMessageEvent) =>
  joinChannel(event.channel)
);

function joinChannel(channel: string) {
  web.channels.join({
    name: channel
  });
}

(async () => {
  const server = await slackEvents.start(parseInt(serverPort));

  const address = server.address();
  const port = isAddressInfo(address) ? address.port : address;

  console.log(`Listening for events on ${port}`);
})();

function isAddressInfo(maybeAddressInfo): maybeAddressInfo is AddressInfo {
  return !!maybeAddressInfo?.port;
}
