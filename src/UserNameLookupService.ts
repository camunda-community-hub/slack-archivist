import { WebClient } from "@slack/web-api";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { getAll } from "./webapi-pagination";
import { SlackConfigObject } from "./lib/Configuration";
import { getLogger } from "./lib/Log";
import winston from "winston";

const CACHEFILE = "./user-cache.json";
type Username = string;
type Channelname = string;
export type UserCache = { [usercode: string]: Username };
export type ChannelCache = { [channelcode: string]: Channelname };

// Caches the user list for 24 hours for performance and to avoid rate-limiting
export class UserNameLookupService {
  slackWeb: WebClient;
  userCache: UserCache;
  channelCache: ChannelCache;
  ready: Promise<void>;
  botname: string;
  private botId!: string;
  log!: winston.Logger;
  constructor(slackWeb: WebClient, slackConfig: SlackConfigObject) {
    this.slackWeb = slackWeb;
    this.userCache = {};
    this.channelCache = {};
    this.botname = slackConfig.botname;
    this.ready = getLogger("Slack Users").then((logger) => {
      this.log = logger;
      if (existsSync(CACHEFILE)) {
        try {
          this.userCache = JSON.parse(readFileSync(CACHEFILE, "utf8"));
          this.log.info(
            `Read ${
              Object.keys(this.userCache).length
            } users from disk cache...`
          );
          this.getBotUserId().then((id) => {
            this.log.info("botuser id", { meta: id });
          });
          return;
        } catch (e) {
          this.log.error("This was a non-fatal error loading the user cache", {
            meta: e,
          });
          return this.fetchAndCacheUserList();
        }
      } else {
        return this.fetchAndCacheUserList();
      }
    });

    // Refresh user names every 24 hours
    const daily = 1000 * 60 * 60 * 24;
    setInterval(() => this.fetchAndCacheUserList(), daily);
  }

  async getChannelName(channelCode: string) {
    if (!this.channelCache[channelCode]) {
      const res = await this.slackWeb.conversations.list().catch((e) => {
        this.log.error("Slack Conversations list Error", { meta: e });
        return { ok: false, channels: [] };
      });
      if (res.ok && res.channels) {
        this.channelCache = (res.channels as any[]).reduce(
          (prev, current) => ({ ...prev, [current.id]: current.name }),
          {}
        );
      }
    }
    return this.channelCache[channelCode];
  }

  async getUserName(usercode: string) {
    await this.ready;
    return this.userCache[usercode];
  }

  async getUsernames(userCodes: string[]) {
    await this.ready; // ensure cache is populated
    return userCodes.map((usercode) => ({
      usercode,
      username: this.userCache[usercode],
    }));
  }

  async getUsernameDictionary() {
    await this.ready;
    return this.userCache;
  }

  async getBotUserId(): Promise<string> {
    await this.ready;
    return (
      this.botId ||
      new Promise((res) => {
        const userId = Object.keys(this.userCache).filter(
          (usercode) => this.userCache[usercode] === this.botname
        );
        this.botId = userId[0];
        res(userId[0]);
      })
    );
  }

  private async fetchAndCacheUserList() {
    // https://api.slack.com/methods/users.list
    this.log.info("Fetching user list from Slack...");
    const users = await getAll(this.slackWeb.users.list, {}, "members");

    this.userCache = users.reduce(
      (users, user) => ({
        ...users,
        [user.id]: user.profile?.display_name || user.name,
      }),
      {}
    );

    this.log.info(`Fetched ${users?.length} from Slack via user.list`);
    try {
      writeFileSync(CACHEFILE, JSON.stringify(this.userCache, null, 2));
      this.log.info("Wrote user cache to disk");
    } catch (e) {
      this.log.error("This was an error writing the user cache to disk", {
        meta: e,
      });
    }
    this.getBotUserId().then((id) => this.log.info("botuser id", { meta: id }));
  }
}
