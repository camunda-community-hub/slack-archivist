import { createEventAdapter } from "@slack/events-api";
import { WebClient } from "@slack/web-api";
import { SlackConfigObject } from "./lib/Configuration";
import { createMessageAdapter } from "@slack/interactive-messages";

export function getSlack(slack: SlackConfigObject) {
  return {
    slackEvents: createEventAdapter(slack.signingSecret),
    slackWeb: new WebClient(slack.token),
    slackInteractions: createMessageAdapter(slack.signingSecret),
  };
}
