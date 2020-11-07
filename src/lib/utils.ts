export function removeBotnameTag(msg: string, botname: string) {
  const botnameTag = `<${botname}>`;
  return msg.includes(botnameTag) ? msg.replace(botnameTag, "") : msg;
}

export function isCommand(msg: string) {
  return msg.startsWith("--");
}

export function parseCommand(msg: string) {
  return msg.substr(2);
}
