// import { SlackMessageEvent } from "./lib/SlackMessage";
import { FileManager } from "./FileManager";
import * as EventsApi from "seratch-slack-types/events-api";
import * as WebApi from "seratch-slack-types/web-api";

const debug = require("debug")("postbuilder");

export interface FileUpload {
  slackUrl: string;
  data?: string;
  discourseUrl?: string;
}

export interface ParsedMessage {
  text: string;
  user: string;
  fileUploads: FileUpload[];
}

interface IUserNameLookupService {
  getUserName: (usercode: string) => Promise<string>;
}

interface IDiscourseAPI {
  uploadFile: (file: string) => Promise<{ url: string } | null>;
}

interface IFileManager {
  getFiles(conversation: ParsedMessage[]): Promise<ParsedMessage[]>;
}

type SlackMessageEvent = WebApi.ConversationsListResponse;

export class PostBuilder {
  private slackPromoMessage: string | undefined;
  private userMap: IUserNameLookupService;
  private messages: SlackMessageEvent[];
  private fileManager: IFileManager;

  constructor({
    userMap,
    slackPromoMessage,
    messages,
    botId,
    fileManager,
  }: {
    slackPromoMessage?: string;
    userMap: IUserNameLookupService;
    messages?: SlackMessageEvent[];
    botId: string;
    fileManager: FileManager;
  }) {
    this.slackPromoMessage = slackPromoMessage;
    this.userMap = userMap;
    // Remove any previous messages from the bot
    this.messages = messages?.filter((msg) => msg.user !== botId) || [];
    this.fileManager = fileManager;
    debug("Input messages: %O", JSON.stringify(messages, null, 2));
  }

  getOP() {
    const messageIsThreadParent = (event: SlackMessageEvent) =>
      event.thread_ts === event.ts;

    return this.messages.filter(messageIsThreadParent)[0];
  }

  async buildMarkdownPostFromConversation(
    messages: SlackMessageEvent[] = this.messages
  ) {
    const optionallyAddSlackPromo = (messages: ParsedMessage[]) =>
      this.slackPromoMessage
        ? [
            {
              fileUploads: [],
              ...messages,
              user: "Note",
              text: this.slackPromoMessage,
            },
          ]
        : messages;

    const threadedConversation = optionallyAddSlackPromo(
      await this.replaceUsercodesWithNames(this.threadMessages(messages))
    );

    // Deal with pictures
    const convWithPictures = await this.fileManager.getFiles(
      threadedConversation
    );

    // tslint:disable-next-line: no-console
    console.log("convWithPictures", JSON.stringify(convWithPictures, null, 2)); // @DEBUG

    const markdownPost = threadedConversation.reduce(
      (prev, message) => `${prev}${this.fileUploadstoMarkdown(message)}

**${message.user}**: ${message.text}`,
      ""
    );

    return markdownPost;
  }

  private fileUploadstoMarkdown(message: ParsedMessage) {
    if (message.fileUploads.length === 0) return "";
    const filelinks = message.fileUploads.reduce(
      (prev, curr) => `${prev}
![](${curr.discourseUrl})`,
      "\n"
    );
    return filelinks + " \n";
  }

  threadMessages(messages: SlackMessageEvent[]) {
    // Somehow it looks like the thread is now threaded already
    const threaded = messages.sort((a, b) => +a.ts - +b.ts);
    // Remove the last message in a multi-post conversation, because it is the call to the bot
    if (threaded.length > 1) {
      threaded.pop();
    }
    return threaded;
  }

  async replaceUsercodesWithNames(
    messageThread: SlackMessageEvent[]
  ): Promise<ParsedMessage[]> {
    // replace the user code in the messages with the name, and return just text and username
    return Promise.all(
      messageThread.map(async (message) => ({
        ...message,
        user: (await this.userMap.getUserName(message.user)) ?? message.user,
        text: this._addReturnForBackTicks(
          await this.replaceUsercodesInText(message.text)
        ),
        fileUploads: (message.files || []).map((file) => ({
          slackUrl: file.url_private,
        })),
      }))
    );
  }

  _addTrailingReturnForBackTicks(text: string) {
    if (text.length < 4) return text;
    return text[3] === "\n" ? text : "```\n" + text.substr(3);
  }

  // A code sample block that starts at the beginning of a message needs a leading CR
  _addReturnForBackTicks(text: string) {
    const idx = text.indexOf("```");
    if (idx === -1) {
      return text;
    }
    if (idx === 0) {
      text = this._addTrailingReturnForBackTicks(text);
      return "\n\n```" + this._addReturnForBackTicks(text.substring(3));
    } else {
      return text[idx - 1] === "\n"
        ? text.substr(0, idx) +
            "```" +
            this._addReturnForBackTicks(text.substr(idx + 3))
        : text.substr(0, idx) +
            "\n```" +
            this._addReturnForBackTicks(text.substr(idx + 3));
    }
  }

  async replaceUsercodesInText(text: string): Promise<string> {
    const start = text.indexOf("<@");
    if (start === -1) {
      return text;
    }
    const nextSpace = text.indexOf(" ", start);
    const to = nextSpace === -1 ? text.length : nextSpace - 1;
    if (text.substr(to, 1) === ">") {
      const substring = text.substring(start, to);
      const usercode = substring.substring(2);
      const username = (await this.userMap.getUserName(usercode)) ?? usercode;
      return this.replaceUsercodesInText(
        text.replace(`${substring}>`, `@${username}`)
      );
    }
    return text;
  }
}
