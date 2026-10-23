import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from '../../src/app-setup.js';
import { AppModule } from '../../src/app.module.js';
import {
  AI_ASSISTANT,
  MARKETING_GENERATOR,
} from '../../src/modules/communications/application/ports/ai-gateway.port.js';
import { EMAIL_SENDER } from '../../src/modules/communications/application/ports/email-sender.port.js';
import { WHATSAPP_GATEWAY } from '../../src/modules/communications/application/ports/whatsapp-gateway.port.js';
import { DIAN_GATEWAY } from '../../src/modules/e-invoicing/application/ports/dian-gateway.port.js';
import { ENVIRONMENT, type Environment } from '../../src/shared/infrastructure/config/environment.js';
import { E2E } from './e2e-databases.js';
import { FakeAiGateway, FakeDianGateway, FakeEmailSender, FakeWhatsAppGateway } from './external-doubles.js';

/** Test doubles of the external gateways, exposed so specs can inspect what was sent. */
export interface ExternalDoubles {
  dian: FakeDianGateway;
  email: FakeEmailSender;
  whatsapp: FakeWhatsAppGateway;
  ai: FakeAiGateway;
}

export interface E2eContext {
  app: INestApplication;
  doubles: ExternalDoubles;
  /** Request builder with `X-Tenant` (and `Authorization` when a token is given). */
  api: (token?: string, tenant?: string) => ApiClient;
  /** Logs in and returns the access token (fails the test on a non-200 answer). */
  login: (email: string, password: string, tenant?: string) => Promise<string>;
  close: () => Promise<void>;
}

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
export type ApiClient = Record<Method, (path: string) => request.Test>;

export const DIRECTOR = { email: 'director@demo.co', password: 'Demo2026' } as const;

/**
 * Boots the real `AppModule` (real PostgreSQL persistence, guards and
 * middleware) with the same HTTP pipeline as `main.ts`; only the gateways to
 * external systems are replaced.
 */
export async function createE2eApp(): Promise<E2eContext> {
  const doubles: ExternalDoubles = {
    dian: new FakeDianGateway(),
    email: new FakeEmailSender(),
    whatsapp: new FakeWhatsAppGateway(),
    ai: new FakeAiGateway(),
  };
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DIAN_GATEWAY)
    .useValue(doubles.dian)
    .overrideProvider(EMAIL_SENDER)
    .useValue(doubles.email)
    .overrideProvider(WHATSAPP_GATEWAY)
    .useValue(doubles.whatsapp)
    .overrideProvider(AI_ASSISTANT)
    .useValue(doubles.ai)
    .overrideProvider(MARKETING_GENERATOR)
    .useValue(doubles.ai)
    .compile();

  const app = moduleRef.createNestApplication({ rawBody: true, logger: ['error', 'warn'] });
  configureApp(app, app.get<Environment>(ENVIRONMENT));
  await app.init();

  const api = (token?: string, tenant: string = E2E.tenant): ApiClient => {
    const build =
      (method: Method) =>
      (path: string): request.Test => {
        const req = request(app.getHttpServer())[method](path).set('X-Tenant', tenant);
        return token ? req.set('Authorization', `Bearer ${token}`) : req;
      };
    return {
      get: build('get'),
      post: build('post'),
      put: build('put'),
      patch: build('patch'),
      delete: build('delete'),
    };
  };

  const login = async (email: string, password: string, tenant: string = E2E.tenant): Promise<string> => {
    const res = await api(undefined, tenant).post('/api/auth/login').send({ email, password });
    if (res.status !== 200 && res.status !== 201) {
      throw new Error(`Login de ${email} falló: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return res.body.accessToken as string;
  };

  return { app, doubles, api, login, close: () => app.close() };
}

/** Today in Bogotá (`YYYY-MM-DD`), the business date the API uses. */
export const todayInBogota = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());

/** Short unique suffix so repeated runs never collide on unique columns. */
export const uniqueSuffix = (): string => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
