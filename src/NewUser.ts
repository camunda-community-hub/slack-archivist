import { WebClient } from "@slack/web-api";
import { web } from "./Slack";

const text = `Welcome!`;

export const greetNewUser = (event) => {
  const { user } = event;
  web.chat.postMessage({
    channel: user,
    as_user: true,
    text,
  });
};
