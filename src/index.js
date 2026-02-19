const app = require('./app');
const { env } = require('./config/env');
const { initDb } = require('./config/db');

async function bootstrap() {
  await initDb();
  app.listen(env.port, () => {
    console.log(`StreamHub API rodando em http://localhost:${env.port}`);
  });
}

bootstrap().catch((error) => {
  console.error('Falha ao iniciar a API:', error.message);
  process.exit(1);
});
