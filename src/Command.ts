import { helpText } from "./messages/help";
import { SlackMessageEvent } from "./lib/SlackMessage";
import { web } from "./Slack";

export function executeCommand({
  command,
  event,
}: {
  command: string;
  event: SlackMessageEvent;
}) {
  switch (command) {
    case "help": {
      return web.chat.postMessage({
        channel: event.channel,
        thread_ts: event.thread_ts,
        text: helpText,
      });
    }
  }
}
