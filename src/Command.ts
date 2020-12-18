import { helpText } from "./messages/help";
import { SlackMessageEvent } from "./lib/SlackMessage";
import { WebClient } from "@slack/web-api";
import { PostBuilder } from "./PostBuilder";

export async function executeCommand({
  command,
  event,
  slackWeb,
  postBuilder,
}: {
  command: string;
  event: SlackMessageEvent;
  slackWeb: WebClient;
  postBuilder: PostBuilder;
}) {
  switch (command) {
    case "help": {
      return slackWeb.chat.postEphemeral({
        user: event.user,
        channel: event.channel,
        thread_ts: event.thread_ts,
        text: helpText,
      });
    }
    case "capture": {
      if (!event.thread_ts) {
        return slackWeb.chat.postEphemeral({
          user: event.user,
          thread_ts: event.thread_ts,
          channel: event.channel,
          text: `This is not a thread. Please execute this command as a reply in a thread`,
        });
      }
      try {
        const discoursePost = await postBuilder.buildMarkdownPostFromConversation();
        return slackWeb.chat.postMessage({
          channel: event.channel,
          thread_ts: event.thread_ts,
          text: discoursePost,
        });
      } catch (e) {
        return slackWeb.chat.postEphemeral({
          user: event.user,
          thread_ts: event.thread_ts,
          channel: event.channel,
          text: `Sorry! I couldn't build that post. I encountered an error: ${JSON.stringify(
            e.message
          )}`,
        });
      }
    }
  }
}
