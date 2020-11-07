import { createEventAdapter } from "@slack/events-api";
import { WebClient } from "@slack/web-api";
import { SlackConfigObject } from "./lib/Configuration";

export function getSlack(slack: SlackConfigObject) {
  // tslint:disable-next-line: no-console
  console.log("configuration", slack); // @DEBUG
  return {
    slackEvents: createEventAdapter(slack.signingSecret),
    slackWeb: new WebClient(slack.token),
  };
}
