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
  channel_type?: string;
  thread_ts?: string;
  edited?: {
    user: string;
    ts: string;
  };
  replies?: {
    user: string;
    ts: string;
  }[];
  files: SlackFile[];
}

export interface SlackFile {
  id: string;
  created: number;
  timestamp: number;
  name: string;
  title: string;
  mimetype: "image/png";
  filetype: "png";
  pretty_type: "PNG";
  user: string;
  editable: false;
  size: number;
  mode: "hosted";
  is_external: false;
  external_type: "";
  is_public: true;
  public_url_shared: false;
  display_as_bot: false;
  username: "";
  url_private: string;
  url_private_download: string;
  thumb_64: string;
  thumb_80: string;
  thumb_360: string;
  thumb_360_w: number;
  thumb_360_h: number;
  thumb_160: string;
  original_w: number;
  original_h: number;
  thumb_tiny: string;
  permalink: string;
  permalink_public: string;
  is_starred: false;
  has_rich_preview: false;
}

export interface SlackMessageElement {
  type: string;
  block_id: string;
  elements: SlackMessageElement[];
}
