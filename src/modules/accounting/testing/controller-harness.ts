import { Test } from '@nestjs/testing';
import type { Type } from '@nestjs/common';

type Mock = { execute: ReturnType<typeof vi.fn> };

/**
 * Builds a controller with every use case replaced by `{ execute: vi.fn() }`
 * returning `{ ok: <UseCaseName> }`.
 */
export const buildController = async <T>(controller: Type<T>, useCases: Type<unknown>[]) => {
  const mocks = new Map<Type<unknown>, Mock>(
    useCases.map((useCase) => [useCase, { execute: vi.fn().mockResolvedValue({ ok: useCase.name }) }]),
  );
  const moduleRef = await Test.createTestingModule({
    controllers: [controller],
    providers: [...mocks].map(([provide, useValue]) => ({ provide, useValue })),
  }).compile();
  return { controller: moduleRef.get(controller), mock: (useCase: Type<unknown>) => mocks.get(useCase) as Mock };
};
