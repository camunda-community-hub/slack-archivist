import PouchDB from "pouchdb-node";
import { Configuration, getConfiguration } from "./lib/Configuration";
PouchDB.plugin(require("pouchdb-find"));

let db: PouchDB.Database<{}> | undefined;

export function getDB(conf: Configuration) {
  if (db) {
    return db;
  }
  db = new PouchDB("slack-archivist-db");
  if (conf.db.url) {
    const remoteCouch = conf.db.url;
    db.replicate.to(remoteCouch, { live: true }, console.log);
    db.replicate.from(remoteCouch, { live: true }, console.log);
    console.log(`Syncing with remote CouchDB`);
  }
  return db;
}
