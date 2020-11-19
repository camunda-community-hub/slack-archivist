import { SlackMessageEvent } from "./lib/SlackMessage";
import { UserNameLookupService } from "./UserNameLookupService";

const debug = require("debug")("postbuilder");

interface ParsedMessage {
  text: string;
  user: string;
}

export class PostBuilder {
  slackPromoMessage: string | undefined;
  userMap: UserNameLookupService;
  messages: SlackMessageEvent[];

  constructor({
    userMap,
    slackPromoMessage,
    messages,
    botId,
  }: {
    slackPromoMessage?: string;
    userMap: UserNameLookupService;
    messages?: SlackMessageEvent[];
    botId: string;
  }) {
    this.slackPromoMessage = slackPromoMessage;
    this.userMap = userMap;
    // Remove the last message, because it is the call to the bot
    messages?.pop();
    // Remove any previous messages from the bot
    this.messages = messages?.filter((msg) => msg.user !== botId) || [];
    debug("Input messages: %O", JSON.stringify(messages, null, 2));
  }

  getOP() {
    const messageIsThreadParent = (event: SlackMessageEvent) =>
      event.thread_ts === event.ts;

    return this.messages.filter(messageIsThreadParent)[0];
  }

  async buildMarkdownPost(messages: SlackMessageEvent[] = this.messages) {
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
      await this.replaceUsercodesWithNames(this.threadMessages(messages))
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

  // Assumes all Slack usercodes have 9 chars
  async replaceUsercodesInText(text: string): Promise<string> {
    const start = text.indexOf("<@");
    if (start === -1) {
      return text;
    }
    if (text.substr(start + 11, 1) === ">") {
      const substring = text.substr(start, 12);
      const usercode = substring.substring(2, 11);
      const username = (await this.userMap.getUserName(usercode)) ?? usercode;
      return this.replaceUsercodesInText(
        text.replace(substring, `@${username}`)
      );
    }
    return text;
  }
}
