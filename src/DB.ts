import PouchDB from "pouchdb-node";
import { Configuration, getConfiguration } from "./lib/Configuration";
import fs from "fs";
import path from "path";

PouchDB.plugin(require("pouchdb-find"));

interface ArchivedConversation {
  _id: string;
  op: string;
  post: string;
  title: string;
  url: string;
  baseUrl: string;
  topic_slug: string;
  topic_id: string;
}

let db: PouchDB.Database<ArchivedConversation> | undefined;

export function getDB(conf: Configuration) {
  if (db) {
    return db;
  }

  const cwd = process.cwd();
  const databaseDir = path.resolve(cwd, "db");
  if (!fs.existsSync(databaseDir)) {
    console.log(`Database directory ${databaseDir} not found. Creating...`);
    fs.mkdirSync(databaseDir);
  }

  db = new PouchDB("db/slack-archivist-db");

  db.createIndex({
    index: {
      fields: ["op"],
    },
  })
    .then(console.log)
    .catch(console.log);
  db.createIndex({
    index: {
      fields: ["url"],
    },
  })
    .then(console.log)
    .catch(console.log);

  if (conf.db.url) {
    const remoteCouch = new PouchDB(conf.db.url);
    console.log(`Setting up sync with remote CouchDB...`);
    // @DEBUG
    console.log(remoteCouch); // @DEBUG
    db.sync(remoteCouch, { live: true, retry: true })
      .on("denied", (info) => console.log("Replication denied", info))
      .on("error", (err) => console.error("DB Sync Error", err))
      .on("active", () => console.log("DB Sync active"))
      .on("paused", (info) => console.log("Paused DB Sync", info));
    remoteCouch.allDocs().then(console.log); // @DEBUG
  }
  return db;
}
