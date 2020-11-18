import * as t from "io-ts";
import * as tPromise from "io-ts-promise";

const DiscourseConfig = t.type({
  category: t.string,
  token: t.string,
  user: t.string,
  url: t.string,
});

const SlackConfig = t.type({
  token: t.string,
  signingSecret: t.string,
  botname: t.string,
  port: t.number,
  client_id: t.string,
  client_secret: t.string,
});

const DBConfig = t.partial({
  url: t.string,
});

const LogLevelConfig = t.keyof({
  error: null,
  warn: null,
  info: null,
  http: null,
  verbose: null,
  debug: null,
  silly: null,
});

export type SlackConfigObject = t.TypeOf<typeof SlackConfig>;
export type DiscourseConfigObject = t.TypeOf<typeof DiscourseConfig>;
export type DBConfigObject = t.TypeOf<typeof DBConfig>;
export type LogConfigObject = {
  level: t.TypeOf<typeof LogLevelConfig>;
};

export type Configuration = {
  slack: SlackConfigObject;
  discourse: DiscourseConfigObject;
  db: DBConfigObject;
  log: LogConfigObject;
};

export async function getConfiguration(): Promise<Configuration> {
  const db = await tPromise.decode(DBConfig)({
    url: process.env.COUCHDB_URL,
  });

  const discourse = await tPromise.decode(DiscourseConfig)({
    category: process.env.DISCOURSE_CATEGORY,
    token: process.env.DISCOURSE_TOKEN,
    user: process.env.DISCOURSE_USER,
    url: process.env.DISCOURSE_URL,
  });

  const slack = await tPromise.decode(SlackConfig)({
    token: process.env.SLACK_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    botname: process.env.SLACK_BOTNAME,
    port: parseInt(process.env.SLACK_PORT || "3000"),
    client_secret: process.env.SLACK_CLIENT_SECRETS,
    client_id: process.env.SLACK_CLIENT_ID,
  });

  const log = {
    level: await tPromise.decode(LogLevelConfig)(
      process.env.LOG_LEVEL?.toUpperCase() || "info"
    ),
  };

  return {
    db,
    discourse,
    slack,
    log,
  };
}
