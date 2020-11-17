import PouchDB from "pouchdb-node";
import { Configuration } from "./lib/Configuration";
import fs from "fs";
import path from "path";
import { getLogger } from "./lib/Log";
import winston from "winston";

const pouchCollate = require("pouchdb-collate");
PouchDB.plugin(require("pouchdb-find"));

export type DB = PouchDB.Database<
  ArchivedConversation | IncrementalUpdatePending | IncrementalUpdate
>;

export enum DocType {
  ArchivedConversation,
  IncrementalUpdate,
  IncrementalUpdatePending,
}

interface NewArchivedConversation {
  thread_ts: string;
  post: string;
  title: string;
  url: string;
  baseUrl: string;
  topic_slug: string;
  topic_id: string;
}

export interface ArchivedConversation extends NewArchivedConversation {
  _id: string;
  type: DocType.ArchivedConversation;
}

interface NewIncrementalUpdatePending {
  thread_ts: string;
  message: string;
  parent: string;
  user: string;
}

export interface IncrementalUpdatePending extends NewIncrementalUpdatePending {
  _id: string;
  type: DocType.IncrementalUpdatePending;
  timestamp: string;
}

export interface IncrementalUpdate extends NewIncrementalUpdatePending {
  _id: string;
  type: DocType.IncrementalUpdate;
  archivedAt: string;
}

let _db: DBWrapper;

export async function getDB(conf: Configuration) {
  return _db || (_db = new DBWrapper(conf)) || _db;
}

class DBWrapper {
  log!: winston.Logger;
  db!: DB;

  constructor(conf: Configuration) {
    getLogger("Database").then((log) => {
      this.log = log;
      const cwd = process.cwd();
      const databaseDir = path.resolve(cwd, "db");
      if (!fs.existsSync(databaseDir)) {
        log.info(`Database directory ${databaseDir} not found. Creating...`);
        fs.mkdirSync(databaseDir);
      }

      this.db = new PouchDB("db/slack-archivist-db");

      const indexError = (msg) =>
        log.error("Error creating database index:", { meta: msg });
      const indexSuccess = (msg) => log.info("Database index:", { meta: msg });
      this.db
        .createIndex({
          index: {
            fields: ["op"],
          },
        })
        .then(indexSuccess)
        .catch(indexError);
      this.db
        .createIndex({
          index: {
            fields: ["url"],
          },
        })
        .then(indexSuccess)
        .catch(indexError);

      if (conf.db.url) {
        const remoteCouch = new PouchDB(conf.db.url);
        log.info(`Setting up sync with remote CouchDB...`);
        this.db
          .sync(remoteCouch, { live: true, retry: true })
          .on("denied", (info) =>
            log.error("Replication denied", { meta: info })
          )
          .on("error", (err) => log.error("DB Sync Error", { meta: err }))
          .on("active", () => log.info("DB Sync active"))
          .on("paused", (info) => log.info("Paused DB Sync"));

        // remoteCouch
        //   .allDocs({ include_docs: true })
        //   .then((res) => console.log(JSON.stringify(res, null, 2))); // @DEBUG
      }
      this.db.info().then((res) => log.info("Database info:", { meta: res }));
    });
  }

  savePendingIncrementalUpdate(
    doc: NewIncrementalUpdatePending & { event_ts: string }
  ) {
    const type = DocType.IncrementalUpdatePending;
    return this.db.put({
      type,
      _id: doc.event_ts,
      timestamp: JSON.stringify(new Date()),
      ...doc,
    });
  }

  getPendingIncrementalUpdates() {
    return this.db.find({
      selector: { type: DocType.IncrementalUpdatePending },
    }) as Promise<PouchDB.Find.FindResponse<IncrementalUpdatePending>>;
  }

  completePendingIncrementalUpdate(doc: IncrementalUpdatePending) {
    return this.db.put({
      ...doc,
      type: DocType.IncrementalUpdate,
      archivedAt: JSON.stringify(new Date()),
    });
  }

  async saveArchivedConversation(doc: NewArchivedConversation) {
    const type = DocType.ArchivedConversation;
    const _id = pouchCollate.toIndexableString([type, doc.thread_ts]);
    // delete any existing document
    // this will happen if we delete a post in Discourse, then re-archive the thread
    try {
      const old = await this.db.get(_id);
      await this.db.remove(old);
    } catch (e) {
      this.log.error("Error removing existing doc", { meta: e });
    }
    return this.db.put({
      type,
      _id: pouchCollate.toIndexableString([type, doc.thread_ts]),
      ...doc,
    });
  }

  getArchivedConversation(thread_ts: string) {
    return this.db.find({
      selector: { thread_ts, type: DocType.ArchivedConversation },
    });
  }
}
