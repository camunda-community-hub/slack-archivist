import { helpText } from "./messages/help";
import { SlackMessageEvent } from "./lib/SlackMessage";
import { WebClient } from "@slack/web-api";

export function executeCommand({
  command,
  event,
  slackWeb,
}: {
  command: string;
  event: SlackMessageEvent;
  slackWeb: WebClient;
}) {
  switch (command) {
    case "help": {
      return slackWeb.chat.postMessage({
        channel: event.channel,
        thread_ts: event.thread_ts,
        text: helpText,
      });
    }
  }
}
