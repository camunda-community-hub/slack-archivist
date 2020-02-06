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

    const parsedMessageThread = replaceUsercodesWithNames(
      messageThread,
      userMap
    );

    if (this.slackPromoMessage) {
      parsedMessageThread.push({
        user: "Note",
        text: this.slackPromoMessage
      });
    }

    return parsedMessageThread.reduce(
      (prev, message) => `${prev}

**${message.user}**: ${message.text}`,
      ""
    );
  }
}
