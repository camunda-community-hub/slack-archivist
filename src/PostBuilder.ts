import { SlackMessageEvent } from "./lib/SlackMessage";
import { UserCache } from "./UserNameLookupService";

interface ParsedMessage {
  text: string;
  user: string;
}

export class PostBuilder {
  slackPromoMessage: string | undefined;
  userMap: UserCache;

  constructor({
    userMap,
    slackPromoMessage,
  }: {
    slackPromoMessage?: string;
    userMap: UserCache;
  }) {
    this.slackPromoMessage = slackPromoMessage;
    this.userMap = userMap;
  }

  buildMarkdownPost(messages: SlackMessageEvent[]) {
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
    const messageIsThreadParent = (event: SlackMessageEvent) =>
      event.thread_ts === event.ts;

    const threadParentMessage = messages.filter(messageIsThreadParent)[0];

    // Reorder the message according to the threading metadata. They are not ordered in the array.
    const orderedRepliesIndex =
      threadParentMessage.replies?.map((reply) => reply.ts) || []; // Allows a single post to be archived by calling the bot in the first thread message
    const messageThread = [threadParentMessage];
    orderedRepliesIndex.forEach((replyts) => {
      const reply = messages.filter((msg) => msg.ts == replyts);
      if (reply.length === 1) {
        messageThread.push(reply[0]);
      }
    });
    return messageThread;
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
