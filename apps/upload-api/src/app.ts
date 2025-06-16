import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { createLogger } from "@scanii/logger";

declare global {
  var process: {
    env: {
      UPLOAD_API_PORT: string;
    };
  };
}

const logger = createLogger("upload-api");

function bootstrap() {
  const app = new Hono();
  const port = Number(process.env.UPLOAD_API_PORT ?? 3000);

  app.get('/', (c) => c.text('Hello World'));

  serve(
    {
      fetch: app.fetch,
      port,
    },
    (info) => {
      logger.info(`Server is running on ${info.address}:${info.port}`);
    },
  );
}

bootstrap();