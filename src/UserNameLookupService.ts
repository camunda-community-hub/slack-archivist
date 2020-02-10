import { WebClient } from "@slack/web-api";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { getAll } from "./webapi-pagination";

const CACHEFILE = "./user-cache.json";
export type UserCache = { [usercode: string]: string };

// Caches the user list for 24 hours for performance and to avoid rate-limiting
export class UserNameLookupService {
  web: WebClient;
  userCache: UserCache;
  ready: Promise<void>;
  constructor(web: WebClient) {
    this.web = web;
    this.userCache = {};
    if (existsSync(CACHEFILE)) {
      try {
        this.userCache = JSON.parse(readFileSync(CACHEFILE, "utf8"));
        console.log(
          `Read ${Object.keys(this.userCache).length} users from disk cache...`
        );
        this.ready = Promise.resolve();
      } catch (e) {
        console.log(e);
        console.log("This was a non-fatal error loading the user cache");
        this.ready = this.fetchAndCacheUserList();
      }
    } else {
      this.ready = this.fetchAndCacheUserList();
    }
    // Refresh user names every 24 hours
    setInterval(() => this.fetchAndCacheUserList(), 1000 * 60 * 60 * 24);
  }

  async getUsernames(userCodes: string[]) {
    await this.ready; // ensure cache is populated
    return userCodes.map(usercode => ({
      usercode,
      username: this.userCache[usercode]
    }));
  }

  async getUsernameDictionary() {
    await this.ready;
    return this.userCache;
  }

  private async fetchAndCacheUserList() {
    // https://api.slack.com/methods/users.list
    console.log("Fetching user list from Slack...");
    const users = await getAll(this.web.users.list, {}, "members");
    users.forEach(
      user =>
        (this.userCache[user.id] = user.profile?.display_name || user.name)
    );
    console.log(`Fetched ${users?.length} from Slack via user.list`);
    try {
      writeFileSync(CACHEFILE, JSON.stringify(this.userCache));
      console.log("Wrote user cache to disk");
    } catch (e) {
      console.log(e);
      console.log("This was an error writing the user cache to disk");
    }
  }
}
