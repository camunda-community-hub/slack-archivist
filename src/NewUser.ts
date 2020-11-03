import { WebClient } from "@slack/web-api";
import { helpText } from "./messages/help";
import { web } from "./Slack";

export const greetNewUser = (event) => {
  const { user } = event;
  web.chat.postMessage({
    channel: user,
    as_user: true,
    text: helpText,
  });
};
