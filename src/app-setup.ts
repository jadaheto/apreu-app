import { type INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import type { Environment } from './shared/infrastructure/config/environment.js';
import { DomainExceptionFilter } from './shared/infrastructure/http/filters/domain-exception.filter.js';

/**
 * HTTP pipeline shared by `main.ts` and the end-to-end tests (`test/`), so both
 * run the same prefix, security headers, validation and error mapping.
 */
export function configureApp(app: INestApplication, env: Environment): void {
  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.use(helmet());
  app.enableCors({ origin: env.corsOrigins, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  // Registered here (not as APP_FILTER) so it also handles errors thrown by middleware (tenant resolution).
  app.useGlobalFilters(new DomainExceptionFilter());
}
