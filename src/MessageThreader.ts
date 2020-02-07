import { SlackMessageEvent } from "./SlackMessage";
import { UserDictionary } from "./PostBuilder";

export interface ParsedMessage {
  text: string;
  user: string;
}

export function threadMessages(messages: SlackMessageEvent[]) {
  const messageIsThreadParent = (event: SlackMessageEvent) =>
    event.thread_ts === event.ts;

  const threadParentMessage = messages.filter(messageIsThreadParent)[0];

  // Reorder the message according to the threading metadata. They are not ordered in the array.
  const orderedRepliesIndex =
    threadParentMessage.replies?.map(reply => reply.ts) || []; // Allows a single post to be archived by calling the bot in the first thread message
  const messageThread = [threadParentMessage];
  orderedRepliesIndex.forEach(replyts => {
    const reply = messages.filter(msg => msg.ts == replyts);
    if (reply.length === 1) {
      messageThread.push(reply[0]);
    }
  });
  return messageThread;
}

export function replaceUsercodesWithNames(
  messageThread: SlackMessageEvent[],
  userMap: UserDictionary[]
): ParsedMessage[] {
  // replace the user code in the messages with the name, and return just text and username
  // @TODO - replace in-line text occurrences of user codes with the username
  return messageThread
    .map(message => ({
      user: getUsernameFromCode(message.user, userMap),
      text: message.text
    }))
    .map(message => ({
      ...message,
      text: addReturnForImmediateCodeSamples(
        replaceUsercodesInText(message.text, userMap)
      )
    }));
}

// A code sample block that starts at the beginning of a message needs a leading CR
function addReturnForImmediateCodeSamples(text: string) {
  return text.startsWith("```") ? `\n${text}` : text;
}

function getUsernameFromCode(usercode: string, userMap: UserDictionary[]) {
  const username = userMap.filter(user => usercode === user.usercode);
  return username.length === 1 ? username[0].username : usercode;
}

// Assumes all Slack usercodes have 9 chars
function replaceUsercodesInText(text: string, userMap: UserDictionary[]) {
  const start = text.indexOf("<@");
  if (start === -1) {
    return text;
  }
  if (text.substr(start + 11, 1) === ">") {
    const substring = text.substr(start, 12);
    const usercode = substring.substring(2, 11);
    const username = getUsernameFromCode(usercode, userMap);
    return replaceUsercodesInText(
      text.replace(substring, `@${username}`),
      userMap
    );
  }
  return text;
}

console.log(
  replaceUsercodesInText("<@UTM6C2C3H>", [
    { usercode: "UTM6C2C3H", username: "archivist" }
  ])
);
