import { SlackMessageEvent } from "./SlackMessage";
import { threadMessages, replaceUsercodesWithNames } from "./MessageThreader";

export interface UserDictionary {
  usercode: string;
  username: string;
}

export class PostBuilder {
  slackPromoMessage: string | undefined;

  constructor(slackPromoMessage?: string) {
    this.slackPromoMessage = slackPromoMessage;
  }

  async buildMarkdownPost(
    messages: SlackMessageEvent[],
    userMap: UserDictionary[]
  ) {
    const messageThread = threadMessages(messages);

    const parsedMessages = replaceUsercodesWithNames(messages, userMap);

    if (this.slackPromoMessage) {
      parsedMessages.push({
        user: "Note",
        text: this.slackPromoMessage
      });
    }

    return messageThread.reduce(
      (prev, message) => `${prev}

**${message.user}**: ${message.text}`,
      ""
    );
  }
}
