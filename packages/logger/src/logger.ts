import winston from "winston";

export type LogInfo = {
  scanId?: string;
  fileId?: string;
  avName?: string;
  avResultId?: string;
  extra?: {
    [key: string]: any;
  };
};

export enum ASCII_COLOR {
  RED = "\x1b[31m",
  GREEN = "\x1b[32m",
  YELLOW = "\x1b[33m",
  BLUE = "\x1b[34m",
  MAGENTA = "\x1b[35m",
  CYAN = "\x1b[36m",
  WHITE = "\x1b[37m",
  RESET = "\x1b[0m",
}

/**
 * Colorize the text with the given color.
 *
 * @param text - The text to colorize.
 * @param color - The color to use.
 * @returns The colored text.
 */
export function colorize(text: string, color: ASCII_COLOR) {
  return `${color}${text}${ASCII_COLOR.RESET}`;
}

/**
 * Get the color for the given level.
 *
 * @param level - The level to get the color for.
 * @returns The color for the given level.
 */
export function getColorByLevel(level: string) {
  switch (level) {
    case "error":
      return ASCII_COLOR.RED;
    case "warn":
      return ASCII_COLOR.YELLOW;
    case "info":
      return ASCII_COLOR.GREEN;
    case "debug":
      return ASCII_COLOR.BLUE;
    default:
      return ASCII_COLOR.WHITE;
  }
}

export function levelPadding(level: string, numPadding: number = 5): string {
  return level.length > numPadding
    ? level.slice(0, numPadding)
    : level.padEnd(numPadding, " ");
}

/**
 * Custom format for the logger.
 *
 * @param {Object} info - The log information.
 * @param {string} info.level - The level of the log.
 * @param {string} info.message - The message of the log.
 * @param {string} info.timestamp - The timestamp of the log.
 * @param {string} info.label - The label of the log.
 */
function customFormat(name: string): winston.Logform.Format {
  return winston.format.printf(
    ({ level, message, timestamp, label, ...meta }) => {
      const levelWithPadding = levelPadding(level, 6);
      const baseLine = `[${timestamp}] [${colorize(levelWithPadding.toUpperCase(), getColorByLevel(level))}] [${label || name}] ${message}`;

      // Extract custom fields like requestId, userId, etc. from `meta`
      const extraFields = Object.entries(meta)
        .map(([key, value]) => `${key}=${value}`)
        .join(" ");

      return extraFields ? `${baseLine}\n  ${extraFields}` : baseLine;
    },
  );
}

function customFormatForFile(name: string): winston.Logform.Format {
  return winston.format.printf(
    ({ level, message, timestamp, label, ...meta }) => {
      const levelWithPadding = levelPadding(level, 6);
      const baseLine = `[${timestamp}] [${levelWithPadding.toUpperCase()}] [${label || name}] ${message}`;

      // Extract custom fields like requestId, userId, etc. from `meta`
      const extraFields = Object.entries(meta)
        .map(([key, value]) => `${key}=${value}`)
        .join(" ");

      return extraFields ? `${baseLine}\n  ${extraFields}` : baseLine;
    },
  );
}

/**
 * A logger for the Scanii API.
 *
 * @param name - The name of the logger.
 * @param defaultLevel - The default level of the logger.
 * @returns The logger instance.
 */
export class ScaniiLogger {
  private logger: winston.Logger;

  constructor(name: string, defaultLevel: string = "info") {
    this.logger = winston.createLogger({
      level: defaultLevel,
      format: winston.format.combine(
        winston.format.label({ label: name }),
        winston.format.timestamp(),
        customFormat(name),
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({
          filename: "error.log",
          level: "error",
          format: customFormatForFile(name),
        }),
        new winston.transports.File({
          filename: "combined.log",
          format: customFormatForFile(name),
        }),
      ],
    });
  }

  public info(message: string, info?: LogInfo, ...args: any[]) {
    this.logger.info(message, info, ...args);
  }

  public error(message: string, info?: LogInfo, ...args: any[]) {
    this.logger.error(message, info, ...args);
  }

  public warn(message: string, info?: LogInfo, ...args: any[]) {
    this.logger.warn(message, info, ...args);
  }

  public debug(message: string, info?: LogInfo, ...args: any[]) {
    this.logger.debug(message, info, ...args);
  }
}

let logger: ScaniiLogger | null = null;

/**
 * Create a logger instance. If the logger is not already created, it will be created with the given name and default level.
 *
 * @param name - The name of the logger.
 * @param defaultLevel - The default level of the logger.
 * @returns The logger instance.
 */
export function createLogger(
  name: string,
  defaultLevel: string = "info",
): ScaniiLogger {
  if (!logger) {
    logger = new ScaniiLogger(name, defaultLevel);
  }
  return logger;
}
