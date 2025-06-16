import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as loggerModule from "./logger";
import winston from "winston";

// Mock winston
vi.mock("winston", () => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  };

  const dummyFormat = {};

  const mockWinston = {
    createLogger: vi.fn(() => mockLogger),
    format: {
      combine: vi.fn(() => dummyFormat),
      label: vi.fn(() => dummyFormat),
      timestamp: vi.fn(() => dummyFormat),
      printf: vi.fn(() => dummyFormat),
    },
    transports: {
      Console: vi.fn(),
      File: vi.fn(),
    },
  };

  return {
    default: mockWinston,
    ...mockWinston,
  };
});

const { ScaniiLogger, createLogger, colorize, getColorByLevel, levelPadding, ASCII_COLOR } = loggerModule;

describe("Logger Utilities", () => {
  describe("colorize", () => {
    it("should wrap text with color codes", () => {
      const text = "test";
      const result = colorize(text, ASCII_COLOR.RED);
      expect(result).toBe(`\x1b[31m${text}\x1b[0m`);
    });
  });

  describe("getColorByLevel", () => {
    it("should return correct color for each level", () => {
      expect(getColorByLevel("error")).toBe(ASCII_COLOR.RED);
      expect(getColorByLevel("warn")).toBe(ASCII_COLOR.YELLOW);
      expect(getColorByLevel("info")).toBe(ASCII_COLOR.GREEN);
      expect(getColorByLevel("debug")).toBe(ASCII_COLOR.BLUE);
      expect(getColorByLevel("unknown")).toBe(ASCII_COLOR.WHITE);
    });
  });

  describe("levelPadding", () => {
    it("should pad level string to specified length", () => {
      expect(levelPadding("info", 5)).toBe("info ");
      expect(levelPadding("error", 5)).toBe("error");
      expect(levelPadding("debug", 3)).toBe("deb");
    });
  });
});

describe("ScaniiLogger", () => {
  let logger: typeof ScaniiLogger.prototype;
  const mockWinstonLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (winston.createLogger as any).mockReturnValue(mockWinstonLogger);
    logger = new ScaniiLogger("test-logger");
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should create logger with correct configuration", () => {
    expect(winston.createLogger).toHaveBeenCalledWith({
      level: "info",
      format: expect.any(Object),
      transports: expect.any(Array),
    });
  });

  it("should call winston logger methods with correct parameters", () => {
    const message = "test message";
    const info = { scanId: "123", fileId: "456" };

    logger.info(message, info);
    expect(mockWinstonLogger.info).toHaveBeenCalledWith(message, info);

    logger.error(message, info);
    expect(mockWinstonLogger.error).toHaveBeenCalledWith(message, info);

    logger.warn(message, info);
    expect(mockWinstonLogger.warn).toHaveBeenCalledWith(message, info);

    logger.debug(message, info);
    expect(mockWinstonLogger.debug).toHaveBeenCalledWith(message, info);
  });
});

describe("createLogger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the singleton logger between tests
    (loggerModule as any).logger = null;
  });

  it("should create a singleton logger instance", () => {
    const logger1 = createLogger("test-logger");
    const logger2 = createLogger("test-logger");
    expect(logger1).toBe(logger2);
  });
});
