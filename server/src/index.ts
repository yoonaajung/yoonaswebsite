import Fastify, { type FastifyInstance } from 'fastify';

export function buildServer(): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  app.get('/', async () => {
    return { message: 'Hello from yoonaswebsite Fastify API' };
  });

  app.get('/health', async () => {
    return { status: 'ok', uptime: process.uptime() };
  });

  interface EchoBody {
    text?: string;
  }

  app.post<{ Body: EchoBody }>('/echo', async (request) => {
    const { text } = request.body ?? {};
    return { echo: text ?? '' };
  });

  return app;
}

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

const app = buildServer();

app
  .listen({ port, host })
  .then((address) => {
    app.log.info(`Server listening at ${address}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
