import { createEventAdapter } from "@slack/events-api";
import { WebClient } from "@slack/web-api";
import { SlackConfigObject } from "./lib/Configuration";

export function getSlack(slack: SlackConfigObject) {
  return {
    slackEvents: createEventAdapter(slack.signingSecret),
    slackWeb: new WebClient(slack.token),
  };
}
