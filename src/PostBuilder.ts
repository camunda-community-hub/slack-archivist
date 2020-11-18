import { SlackMessageEvent } from "./lib/SlackMessage";
import { createSuccessMessage } from "./messages/post-success";
import { UserCache } from "./UserNameLookupService";

const debug = require("debug")("postbuilder");

interface ParsedMessage {
  text: string;
  user: string;
}

export class PostBuilder {
  slackPromoMessage: string | undefined;
  userMap: UserCache;
  messages: SlackMessageEvent[];

  constructor({
    userMap,
    slackPromoMessage,
    messages,
    botId,
  }: {
    slackPromoMessage?: string;
    userMap: UserCache;
    messages?: SlackMessageEvent[];
    botId: string;
  }) {
    this.slackPromoMessage = slackPromoMessage;
    this.userMap = userMap;
    // Remove the last message, because it is the call to the bot
    messages?.pop();
    // Remove any previous messages from the bot
    this.messages = messages?.filter((msg) => msg.user !== botId) || [];
    debug("Input messages: $O" + JSON.stringify(messages, null, 2));
  }

  /**
   * Scans back through the messages to see if the Archivist reported that it
   * archived it earlier in the conversation.
   */
  hasAlreadyBeenArchived() {
    const uniqueString = "_x_^_0_";
    const archivistMessage = createSuccessMessage(uniqueString);
    const archivistFragment = archivistMessage.substring(
      0,
      archivistMessage.indexOf(uniqueString)
    );
    const previousArchive = this.messages.filter((message) =>
      message.text.includes(archivistFragment)
    );
    if (previousArchive.length === 0) return false;
    const previousArchiveMessage = previousArchive[0].text;

    const urlStartsAt = archivistMessage.indexOf(uniqueString);
    return previousArchiveMessage.substring(
      urlStartsAt,
      previousArchiveMessage.indexOf(" ", urlStartsAt)
    );
  }

  getOP() {
    const messageIsThreadParent = (event: SlackMessageEvent) =>
      event.thread_ts === event.ts;

    return this.messages.filter(messageIsThreadParent)[0];
  }

  buildMarkdownPost(messages: SlackMessageEvent[] = this.messages) {
    const optionallyAddSlackPromo = (messages) =>
      this.slackPromoMessage
        ? [
            ...messages,
            {
              user: "Note",
              text: this.slackPromoMessage,
            },
          ]
        : messages;

    return optionallyAddSlackPromo(
      this.replaceUsercodesWithNames(this.threadMessages(messages))
    ).reduce(
      (prev, message) => `${prev}

**${message.user}**: ${message.text}`,
      ""
    );
  }

  threadMessages(messages: SlackMessageEvent[]) {
    // Somehow it looks like the thread is now threaded already
    return messages;
  }

  replaceUsercodesWithNames(
    messageThread: SlackMessageEvent[]
  ): ParsedMessage[] {
    // replace the user code in the messages with the name, and return just text and username
    return messageThread.map((message) => ({
      ...message,
      user: this.userMap[message.user] ?? message.user,
      text: this._addReturnForBackTicks(
        this.replaceUsercodesInText(message.text)
      ),
    }));
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

  // Assumes all Slack usercodes have 9 chars
  replaceUsercodesInText(text: string): string {
    const start = text.indexOf("<@");
    if (start === -1) {
      return text;
    }
    if (text.substr(start + 11, 1) === ">") {
      const substring = text.substr(start, 12);
      const usercode = substring.substring(2, 11);
      const username = this.userMap[usercode] ?? usercode;
      return this.replaceUsercodesInText(
        text.replace(substring, `@${username}`)
      );
    }
    return text;
  }
}
