import { createMessageAdapter } from "@slack/interactive-messages";
import { configuration } from "./config";

const slackInteractions = createMessageAdapter(
  configuration.slack.signingSecret
);
