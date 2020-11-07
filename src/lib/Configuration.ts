import * as t from "io-ts";
import * as tPromise from "io-ts-promise";

require("dotenv").config();

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
  port: t.string,
});

export type SlackConfigObject = t.TypeOf<typeof SlackConfig>;
export type DiscourseConfigObject = t.TypeOf<typeof DiscourseConfig>;

export async function getConfiguration() {
  const discourse = await tPromise.decode(DiscourseConfig)({
    category: process.env.DISCOURSE_CATEGORY,
    token: process.env.DISCOURSE_TOKEN,
    user: process.env.DISCOURSE_USER,
    url: process.env.DISCOURSE_URL,
  });

  const slack = await tPromise.decode(SlackConfig)({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    promoMessage: process.env.SLACK_PROMO_MESSAGE,
    botname: process.env.SLACK_BOTNAME,
    port: process.env.SLACK_PORT || "3000",
  });
  return {
    discourse,
    slack,
  };
}
