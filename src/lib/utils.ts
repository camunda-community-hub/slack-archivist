export function removeBotnameTag(msg: string, botname: string) {
  const botnameTag = `<@${botname}>`;
  return msg.includes(botnameTag)
    ? msg.replace(botnameTag, "").trim()
    : msg.trim();
}

export function isCommand(msg: string) {
  return msg.trim().startsWith("--");
}

export function parseCommand(msg: string) {
  return msg.trim().substr(2);
}
