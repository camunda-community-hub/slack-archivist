import { createMessageAdapter } from "@slack/interactive-messages";
import { getConfiguration } from "./lib/Configuration";

export async function getSlackInteractions() {
  const configuration = await getConfiguration();
  return createMessageAdapter(configuration.slack.signingSecret);
}
