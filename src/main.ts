import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { configureApp } from './app-setup.js';
import { AppModule } from './app.module.js';
import { ENVIRONMENT, type Environment } from './shared/infrastructure/config/environment.js';

/** Loads `.env` when present (Node ≥ 20.12). Real environment variables take precedence. */
function loadDotEnv(): void {
  try {
    process.loadEnvFile('.env');
  } catch {
    // No .env file: rely on the process environment (production).
  }
}

async function bootstrap() {
  loadDotEnv();
  // rawBody: webhooks (WhatsApp) verify HMAC signatures over the exact bytes received.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const env = app.get<Environment>(ENVIRONMENT);
  // Behind apreu-web's nginx: the throttler must see the client IP, not the proxy's.
  app.set('trust proxy', env.trustProxy);

  configureApp(app, env);
  app.enableShutdownHooks();

  if (env.nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Apreu API')
      .setDescription(
        'ERP escolar Apreu: API por colegio (multi-tenant). Envíe la cabecera X-Tenant con el slug del colegio.',
      )
      .setVersion('2.0.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, config));
  }

  await app.listen(env.port);
}
await bootstrap();
