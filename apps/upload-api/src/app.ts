import { Hono } from 'hono';
import { serve } from '@hono/node-server';

declare global {
  var process: {
    env: {
      PORT: string;
    };
  };
}

const app = new Hono();
const port = Number(process.env.PORT ?? 3000);

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
