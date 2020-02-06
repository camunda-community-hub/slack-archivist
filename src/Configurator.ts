let config: any = {};

try {
  config = require("../config");
} catch (e) {
  console.log(
    "Error loading ../config.json - using environment variables only for configuration."
  );
}

// Discourse
export const discourse = config?.discourse;
export const discourseToken =
  process.env.DISCOURSE_TOKEN || discourse?.token || "";
export const discourseUser =
  process.env.DISCOURSE_USER || discourse?.user || "";
export const discourseCategory =
  process.env.DISCOURSE_CATEGORY || discourse?.category || "";
export const discourseUrl = process.env.DISCOURSE_URL || discourse?.url || "";

// Slack
export const token =
  process.env.SLACK_BOT_TOKEN || config?.slack?.bot_token || "";
export const slackSigningSecret =
  process.env.SLACK_SIGNING_SECRET || config?.slack?.signing_secret || "";
export const slackPromoMessage =
  process.env.SLACK_PROMO_MESSAGE || config?.slack?.promo_message || undefined;
