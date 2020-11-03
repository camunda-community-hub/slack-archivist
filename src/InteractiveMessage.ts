import { createMessageAdapter } from "@slack/interactive-messages";
import { configuration } from "./Configuration";

const slackInteractions = createMessageAdapter(
  configuration.slack.signingSecret
);
