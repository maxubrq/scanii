import { serve } from "@hono/node-server";
import { Hono } from "hono";

declare global {
  var process: {
    env: {
      UPLOAD_API_PORT: string;
    };
  };
}

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
      console.log(`Server is running on ${info.address}:${info.port}`);
    },
  );
}