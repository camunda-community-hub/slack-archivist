import PouchDB from "pouchdb-node";
import { Configuration } from "./lib/Configuration";
import fs from "fs";
import path from "path";
import { getLogger } from "./lib/Log";
import winston from "winston";

const debug = require("debug")("db");

const pouchCollate = require("pouchdb-collate");
PouchDB.plugin(require("pouchdb-find"));

export type DB = PouchDB.Database<
  | ArchivedConversation
  | IncrementalUpdatePending
  | IncrementalUpdate
  | IncrementalUpdatePostDeleted
>;

export enum DocType {
  ArchivedConversation = "ArchivedConversation",
  IncrementalUpdate = "IncrementalUpdate",
  IncrementalUpdatePending = "IncrementalUpdatePending",
  IncrementalUpdatePostDeleted = "IncrementalUpdatePostDeleted",
}

interface NewArchivedConversation {
  thread_ts: string;
  post: string;
  title: string;
  url: string;
  baseUrl: string;
  topic_slug: string;
  topic_id: number;
}

export interface ArchivedConversation extends NewArchivedConversation {
  _id: string;
  type: DocType.ArchivedConversation;
}

interface NewIncrementalUpdatePending {
  thread_ts: string;
  message: string;
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

export interface IncrementalUpdatePostDeleted
  extends NewIncrementalUpdatePending {
  _id: string;
  type: DocType.IncrementalUpdatePostDeleted;
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
            fields: ["thread_ts"],
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
      this.db
        .createIndex({
          index: {
            fields: ["type"],
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
      this.db
        .allDocs({ include_docs: true })
        .then((docs) => console.log("allDocs", JSON.stringify(docs, null, 2))); // @DEBUG
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

  discardPendingIncrementalUpdate(doc: IncrementalUpdatePending) {
    return this.db.put({
      ...doc,
      archivedAt: JSON.stringify(new Date()),
      type: DocType.IncrementalUpdatePostDeleted,
    });
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
    const _id = this.getArchivedConversationId(doc.thread_ts);
    // delete any existing document
    // this will happen if we delete a post in Discourse, then re-archive the thread
    await this.db
      .get(_id)
      .then((old) => this.db.remove(old))
      .catch((e) => `No existing record`);
    return this.db
      .put({
        type,
        _id: this.getArchivedConversationId(doc.thread_ts),
        ...doc,
      })
      .catch((e) => this.log.error(e));
  }

  getArchivedConversation(thread_ts: string) {
    const _id = this.getArchivedConversationId(thread_ts);
    debug(`Requesting ArchivedConversationId ${_id}`);
    return this.db
      .get(_id)
      .then((res) => res as ArchivedConversation)
      .catch((e) => {
        debug(`Response: ${e}`);
        return null;
      });
  }

  private getArchivedConversationId(thread_ts: string) {
    return pouchCollate.toIndexableString([
      DocType.ArchivedConversation,
      thread_ts,
    ]);
  }
}
