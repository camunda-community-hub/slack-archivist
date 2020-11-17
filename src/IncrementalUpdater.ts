import { SlackMessageEvent } from "./lib/SlackMessage";
import { DiscourseAPI } from "./Discourse";
import { PostBuilder } from "./PostBuilder";
import { getDB } from "./DB";
import { getLogger } from "./lib/Log";
import winston from "winston";

type Await<T> = T extends Promise<infer U> ? U : T;

export class IncrementalUpdater {
  private postBuilder: PostBuilder;
  private isRunning: boolean = false;
  private started = false;
  private periodMs = 20 * 1000;
  private db: Await<ReturnType<typeof getDB>>;
  private discourseAPI: DiscourseAPI;
  private log!: winston.Logger;
  constructor({
    db,
    discourseAPI,
    postBuilder,
  }: {
    db: Await<ReturnType<typeof getDB>>;
    discourseAPI: DiscourseAPI;
    postBuilder: PostBuilder;
  }) {
    this.postBuilder = postBuilder;
    this.discourseAPI = discourseAPI;
    this.db = db;
  }

  public async start() {
    if (this.started) {
      return;
    }
    this.started = true;
    this.log = await getLogger("IncrementalUpdate");
    this.log.info("Starting Incremental Updater");
    setInterval(async () => {
      if (this.isRunning) {
        this.log.info("Incremental update already running. Bailing..."); // @DEBUG
        return;
      }
      this.log.info("Running incremental update"); // @DEBUG

      this.isRunning = true;
      const updates = await this.db.getPendingIncrementalUpdates();

      this.log.info(`Found ${updates.docs.length} updates...`);
      // we need to order them by timestamp
      updates.docs.forEach(async (doc) => {
        const { thread_ts } = doc;
        const text = this.postBuilder.replaceUsercodesWithNames([
          {
            text: doc.message,
            user: doc.user,
          },
        ] as SlackMessageEvent[]);

        console.log("text", text);
        console.log("doc", doc);
        // process it into Discourse
        // add the record to Pouch / remove the pending record
        await this.db.completePendingIncrementalUpdate(doc);
      });

      this.isRunning = false;
    }, this.periodMs);
  }
}
