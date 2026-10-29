// stdout carries the MCP protocol, so everything here goes to stderr.
const ts = (): string => new Date().toLocaleTimeString('en-US', { hour12: false });
const line = (message: string): void => {
  process.stderr.write(`[framelink] ${message}\n`);
};

export const logger = {
  info: (message: string): void => line(`${ts()} ${message}`),
  success: (message: string): void => line(message),
  warn: (message: string): void => line(`warning: ${message}`),
  error: (message: string): void => line(`error: ${message}`),
  request: (type: string, ms: number): void => {
    if (process.env.LOG_LEVEL === 'debug') line(`${type} ${ms}ms`);
  },
  debug: (message: string): void => {
    if (process.env.LOG_LEVEL === 'debug') line(message);
  },
};
