import PouchDB from "pouchdb-node";
import { Configuration } from "./lib/Configuration";
import fs from "fs";
import path from "path";
import { getLogger } from "./lib/Log";

PouchDB.plugin(require("pouchdb-find"));

export enum DocType {
  ArchivedConversation,
  IncrementalUpdate,
  IncrementalUpdatePending,
}

export interface ArchivedConversation {
  _id: string;
  type: DocType.ArchivedConversation;
  op: string;
  post: string;
  title: string;
  url: string;
  baseUrl: string;
  topic_slug: string;
  topic_id: string;
}

interface IncrementalUpdatePending {
  _id: string;
  type: DocType.IncrementalUpdatePending;
  op: string;
  message: string;
  timestamp: string;
}

let db:
  | PouchDB.Database<ArchivedConversation | IncrementalUpdatePending>
  | undefined;

export async function getDB(conf: Configuration) {
  if (db) {
    return db;
  }

  const log = await getLogger("Database");
  const cwd = process.cwd();
  const databaseDir = path.resolve(cwd, "db");
  if (!fs.existsSync(databaseDir)) {
    log.info(`Database directory ${databaseDir} not found. Creating...`);
    fs.mkdirSync(databaseDir);
  }

  db = new PouchDB("db/slack-archivist-db");

  const indexError = (msg) =>
    log.error("Error creating database index:", { meta: msg });
  const indexSuccess = (msg) => log.info("Database index:", { meta: msg });
  db.createIndex({
    index: {
      fields: ["op"],
    },
  })
    .then(indexSuccess)
    .catch(indexError);
  db.createIndex({
    index: {
      fields: ["url"],
    },
  })
    .then(indexSuccess)
    .catch(indexError);

  if (conf.db.url) {
    const remoteCouch = new PouchDB(conf.db.url);
    log.info(`Setting up sync with remote CouchDB...`);
    db.sync(remoteCouch, { live: true, retry: true })
      .on("denied", (info) => log.error("Replication denied", { meta: info }))
      .on("error", (err) => log.error("DB Sync Error", { meta: err }))
      .on("active", () => log.info("DB Sync active"))
      .on("paused", (info) => log.info("Paused DB Sync"));

    // remoteCouch
    //   .allDocs({ include_docs: true })
    //   .then((res) => console.log(JSON.stringify(res, null, 2))); // @DEBUG
  }
  db.info().then((res) => log.info("Database info:", { meta: res }));

  return db;
}
