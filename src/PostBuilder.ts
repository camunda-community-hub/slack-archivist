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
    const optionallyAddSlackPromo = messages =>
      this.slackPromoMessage
        ? [
            ...messages,
            {
              user: "Note",
              text: this.slackPromoMessage
            }
          ]
        : messages;

    return optionallyAddSlackPromo(
      replaceUsercodesWithNames(threadMessages(messages), userMap)
    ).reduce(
      (prev, message) => `${prev}

**${message.user}**: ${message.text}`,
      ""
    );
  }
}
