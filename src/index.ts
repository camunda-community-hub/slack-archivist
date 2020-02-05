import { createEventAdapter } from "@slack/events-api";
import { WebClient } from "@slack/web-api";
import { AddressInfo } from "net";
import SlackEventAdapter from "@slack/events-api/dist/adapter";
import { EventEmitter } from "events";
import {
  isThreadedMessage,
  isThreadParent,
  SlackMessageEvent
} from "./SlackMessage";
import { getAll } from "./webapi-pagination";
import { UserNameLookupService } from "./UserNameLookupService";
import { DiscourseAPI } from "./Discourse";
const config = require("../config");

const token = process.env.SLACK_BOT_TOKEN || config?.slack?.bot_token || "";
const slackSigningSecret =
  process.env.SLACK_SIGNING_SECRET || config?.slack?.signing_secret || "";

const slackEvents: SlackEventAdapter & EventEmitter = createEventAdapter(
  slackSigningSecret
) as any;

const discourseAPI = new DiscourseAPI();

const web = new WebClient(token);
const userlookup = new UserNameLookupService(web);

const serverPort = process.env.PORT || "3000";

slackEvents.on("message", (event: SlackMessageEvent) => {
  //   console.log(
  //     `Received a message event: user ${event.user} in channel ${event.channel} says ${event.text}`
  //   );
});

slackEvents.on("app_mention", async (event: SlackMessageEvent) => {
  const { channel } = event;
  // Brute force
  web.channels.join({
    name: channel
  });
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
  // build a unique user set
  const users = new Set<string>();
  messages.forEach(msg => users.add(msg.user));
  const userMap = await userlookup.getUsernames(Array.from(users));
  // replace the user code in the messages with the name
  userMap.forEach(user =>
    messages.forEach(message => {
      if (message.user === user.usercode) {
        message.user = user.username;
      }
    })
  );

  const threadParentMessage = messages.filter(isThreadParent)[0];

  const repliesTs = threadParentMessage.replies?.map(reply => reply.ts);
  const messageThread = [threadParentMessage];
  console.log(repliesTs);
  repliesTs?.forEach(replyts => {
    const reply = messages.filter(msg => msg.ts == replyts);
    if (reply.length === 1) {
      messageThread.push(reply[0]);
    }
  });
  return messageThread.reduce(
    (prev, message) => `${prev}

**${message.user}**: ${message.text}`,
    ""
  );
}

// For when someone mentions the bot in a new channel
slackEvents.on("link_shared", async (event: SlackMessageEvent) => {
  const { channel } = event;
  // Brute force
  web.channels.join({
    name: channel
  });
});

slackEvents.on("channel_joined", event => console.log);

(async () => {
  const server = await slackEvents.start(parseInt(serverPort));

  const address = server.address();
  const port = isAddressInfo(address) ? address.port : address;

  console.log(`Listening for events on ${port}`);
})();

function isAddressInfo(maybeAddressInfo): maybeAddressInfo is AddressInfo {
  return !!maybeAddressInfo?.port;
}
