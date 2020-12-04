import { DiscourseAPI } from "./Discourse";
import { SlackFileRecord, _DBWrapper } from "./DB";
import { FileUpload, ParsedMessage } from "./PostBuilder";
import Axios from "axios";
import { getLogger } from "./lib/Log";
import winston from "winston";
import { SlackMessageEvent } from "./lib/SlackMessage";
const debug = require("debug")("db");

export class FileManager {
  private slackToken: string;
  private discourseAPI: DiscourseAPI;
  private db: _DBWrapper;
  private log!: winston.Logger;

  constructor({
    slackToken,
    discourseAPI,
    db,
  }: {
    slackToken: string;
    discourseAPI: DiscourseAPI;
    db: _DBWrapper;
  }) {
    this.slackToken = slackToken;
    this.discourseAPI = discourseAPI;
    this.db = db;
    getLogger("FileManager").then((logger) => (this.log = logger));
  }

  async getFiles(threadedConversation: SlackMessageEvent[]) {
    return Promise.all(
      threadedConversation.map(async (message) => ({
        ...message,
        fileUploads: await Promise.all(
          (message.files || []).map((file) =>
            this.getFile({
              slackUrl: file.url_private,
              mimetype: file.mimetype,
            })
          )
        ),
      }))
    );
  }

  private async getFile(file: FileUpload) {
    this.log.info(`Getting ${file.slackUrl} from database...`);
    const fileFromDB = await this.db.getSlackFile(file.slackUrl);
    if (fileFromDB) {
      this.log.info(
        `Got record from database: ${JSON.stringify(
          { ...fileFromDB, data: "erased" },
          null,
          2
        )}`
      );
      if (file.discourseUrl) {
        return fileFromDB;
      } else {
        debug("No discourseUrl...");
        const hasData = !!file.data;
        debug(`Has downloaded data: ${hasData}`);
        const fileDownload = hasData
          ? fileFromDB
          : await this.getFileFromSlack(fileFromDB);
        return fileDownload ? this.postFileToDiscourse(fileDownload) : file;
      }
    }
    debug(`Not found in database`);
    const fileWithDownload = await this.getFileFromSlack(file);
    return fileWithDownload ? this.postFileToDiscourse(fileWithDownload) : file;
  }

  private async getFileFromSlack(file: FileUpload) {
    this.log.info(`Downloading image ${file.slackUrl} from Slack...`);
    return Axios.get(file.slackUrl, {
      headers: { Authorization: "Bearer " + this.slackToken },
    }).then((res) =>
      this.db.saveSlackFile({
        ...file,
        data: res.data,
      })
    );
  }

  private async postFileToDiscourse(file: SlackFileRecord) {
    this.log.info(`Posting ${file.slackUrl} to Discourse`);
    const discourseRes = await this.discourseAPI.uploadFile(file);
    this.log.info(`Posted to Discourse as ${discourseRes}`);
    return (
      (await this.db.saveSlackFile({
        ...file,
        discourseUrl: discourseRes?.url,
      })) || file
    );
  }
}
