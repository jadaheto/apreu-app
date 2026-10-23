import { Test } from '@nestjs/testing';
import type { Type } from '@nestjs/common';
import { ROLES_KEY } from '../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { IS_PUBLIC_KEY } from '../../../shared/infrastructure/http/decorators/public.decorator.js';
import type { Role } from '../../../shared/domain/role.js';

/** A use case double whose `execute` resolves to `{ ok: <name> }`. */
export const useCaseMock = (name: string) => ({ execute: vi.fn().mockResolvedValue({ ok: name }) });

/** Builds the controller with every use case replaced by {@link useCaseMock}. */
export const buildController = async <T>(controller: Type<T>, useCases: Type<unknown>[]) => {
  const mocks = new Map(useCases.map((u) => [u, useCaseMock(u.name)]));
  const moduleRef = await Test.createTestingModule({
    controllers: [controller],
    providers: useCases.map((u) => ({ provide: u, useValue: mocks.get(u) })),
  }).compile();
  return { controller: moduleRef.get(controller), mock: (u: Type<unknown>) => mocks.get(u)! };
};

/** Effective roles of a handler (method metadata overrides the class). */
export const rolesOf = (controller: Type<unknown>, method: string): Role[] | undefined =>
  Reflect.getMetadata(ROLES_KEY, controller.prototype[method]) ?? Reflect.getMetadata(ROLES_KEY, controller);

export const isPublic = (controller: Type<unknown>, method: string): boolean =>
  Reflect.getMetadata(IS_PUBLIC_KEY, controller.prototype[method]) === true;
