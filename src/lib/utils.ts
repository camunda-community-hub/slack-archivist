export function removeUsernameTag(msg: string) {
  return msg.startsWith("<") ? msg.substr(msg.indexOf(">") + 1).trim() : msg;
}

export function isCommand(msg: string) {
  return msg.startsWith("--");
}

export function parseCommand(msg: string) {
  return msg.substr(2);
}
