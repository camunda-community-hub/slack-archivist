export const isThreadedMessage = (event: SlackMessageEvent) =>
  !!event.thread_ts;
export const isThreadParent = (event: SlackMessageEvent) =>
  event.thread_ts === event.ts;

export interface SlackMessageEvent {
  client_msg_id: string;
  type: string;
  subtype?: string;
  text: string;
  user: string;
  ts: string;
  team: string;
  blocks: [{ type: string; block_id: string; elements: SlackMessageElement[] }];
  channel: string;
  event_ts: string;
  channel_type: string;
  thread_ts?: string;
  edited?: {
    user: string;
    ts: string;
  };
  replies?: {
    user: string;
    ts: string;
  }[];
}

export interface SlackMessageElement {
  type: string;
  block_id: string;
  elements: SlackMessageElement[];
}
