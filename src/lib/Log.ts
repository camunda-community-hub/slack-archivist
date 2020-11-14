import { getConfiguration } from "./Configuration";
import winston from "winston";
import colorize from "json-colorizer";
import { format as f } from "logform";
import chalk from "chalk";

const colors = [
  chalk.greenBright,
  chalk.yellowBright,
  chalk.magentaBright,
  chalk.cyanBright,
  chalk.whiteBright,
];

let logger: winston.Logger | undefined;
let loggers: { [namespace: string]: winston.Logger } = {};

const { combine, timestamp, label, printf, prettyPrint } = winston.format;
const colorizeFormat = f.colorize({ colors: { info: "blue", error: "red" } });

const format = printf((info) => {
  const { level, message, label, timestamp, meta } = info;

  return meta
    ? `${timestamp} [${label}] ${level}: ${message} ${colorize(
        JSON.stringify(meta, null, 2)
      )}`
    : `${timestamp} [${label}] ${level}: ${message}`;
});

export async function getLogger(namespace: string = "main") {
  const { combine, timestamp, label, printf } = winston.format;

  if (!logger) {
    const conf = await getConfiguration();

    logger = winston.createLogger({
      format: combine(timestamp(), colorizeFormat, format),
      level: conf.log.level,
      transports: [new winston.transports.Console()],
    });
  }
  if (!loggers[namespace]) {
    const color = colors[Object.keys(loggers).length % colors.length];
    loggers[namespace] = logger.child({
      label: color(namespace),
      format: combine(label({ label: namespace }), timestamp(), format),
    });
  }
  return loggers[namespace];
}
