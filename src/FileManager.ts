import { DiscourseAPI } from "./Discourse";
import { SlackFileRecord, _DBWrapper } from "./DB";
import { FileUpload, ParsedMessage } from "./PostBuilder";
import Axios from "axios";
import { getLogger } from "./lib/Log";
import winston from "winston";

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
    getLogger("Database").then((logger) => (this.log = logger));
  }

  async getFiles(threadedConversation: ParsedMessage[]) {
    return Promise.all(
      threadedConversation.map(async (message) => ({
        ...message,
        fileUploads: await Promise.all(
          message.fileUploads.map((file) => this.getFile(file))
        ),
      }))
    );
  }

  private async getFile(file: FileUpload) {
    const fileFromDB = await this.db.getSlackFile(file.slackUrl);
    if (fileFromDB) {
      if (!file.discourseUrl) {
        const fileDownload = !file.data
          ? await this.getFileFromSlack(file)
          : fileFromDB;
        return fileDownload ? this.postFileToDiscourse(fileDownload) : file;
      }
      return fileFromDB;
    }
    const fileWithDownload = await this.getFileFromSlack(file);
    return fileWithDownload ? this.postFileToDiscourse(fileWithDownload) : file;
  }

  private async getFileFromSlack(file: FileUpload) {
    return Axios.get(file.slackUrl, {
      headers: { Authorization: "Bearer " + this.slackToken },
    }).then(async (res) =>
      this.db.saveSlackFile({
        ...file,
        data: res.data,
      })
    );
  }

  private async postFileToDiscourse(file: SlackFileRecord) {
    const discourseRes = await this.discourseAPI.uploadFile(file.data!);
    return (
      (await this.db.saveSlackFile({
        ...file,
        discourseUrl: discourseRes?.url,
      })) || file
    );
  }
}
