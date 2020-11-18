import { SlackMessageEvent } from "./lib/SlackMessage";
import { DiscourseAPI, DiscourseSuccessMessage } from "./Discourse";
import { PostBuilder } from "./PostBuilder";
import { getDB } from "./DB";
import { getLogger } from "./lib/Log";
import winston from "winston";
import { fold } from "fp-ts/lib/Either";

const debug = require("debug")("updates");

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
        this.log.info("Incremental update already running. Bailing...");
        return;
      }

      this.isRunning = true;
      const updates = await this.db.getPendingIncrementalUpdates();
      if (updates.docs.length > 0) {
        this.log.info(`Found ${updates.docs.length} updates...`);
        debug("Pending updates: O%", updates);
      }
      // we need to order them by timestamp
      updates.docs.forEach(async (doc) => {
        const [scrubbed] = this.postBuilder.replaceUsercodesWithNames([
          {
            text: doc.message,
            user: doc.user,
          },
        ] as SlackMessageEvent[]);

        const text = `**${scrubbed.user}**: ${scrubbed.text}`;

        console.log("text", text);
        console.log("doc", doc);
        const existingPostFromDb = await this.db.getArchivedConversation(
          doc.thread_ts
        );

        if (!existingPostFromDb) {
          return this.db.discardPendingIncrementalUpdate(doc);
        }

        const postFromDiscourse =
          existingPostFromDb &&
          (await this.discourseAPI.getPost(existingPostFromDb.url));

        // Post was deleted
        if (postFromDiscourse && postFromDiscourse.status === 404) {
          return this.db.discardPendingIncrementalUpdate(doc);
        }

        // process it into Discourse
        const res = await this.discourseAPI.addToPost(
          existingPostFromDb.topic_id,
          text
        );
        const discoursePostSucceeded = async (res: DiscourseSuccessMessage) => {
          // add the record to Pouch / remove the pending record
          await this.db.completePendingIncrementalUpdate({
            ...doc,
            ...res,
          });
          debug(`Marked pending update ${doc._id} as completed.`);
        };
        const discoursePostFailed = (e: Error) => {
          this.log.error("Error posting to Discourse", { meta: e });
        };
        fold(discoursePostFailed, discoursePostSucceeded)(res);
      });

      this.isRunning = false;
    }, this.periodMs);
  }
}
