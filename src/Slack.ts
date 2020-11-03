import { configuration } from "./Configuration";
import { createEventAdapter } from "@slack/events-api";
import { WebClient } from "@slack/web-api";

export const slackEvents = createEventAdapter(
  configuration.slack.signingSecret
);
export const web = new WebClient(configuration.slack.token);
