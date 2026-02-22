import pino from "pino";

const IS_DEBUG = process.env.DEBUG === "true";
const IS_PROD = process.env.NODE_ENV === "production" || !!process.env.VERCEL;

export const logger = pino({
  level: IS_DEBUG ? "debug" : "info",
  ...(!IS_PROD
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            ignore: "pid,hostname",
            translateTime: "SYS:standard",
          },
        },
      }
    : {}),
});
