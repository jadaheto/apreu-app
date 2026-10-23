import { Test } from '@nestjs/testing';
import type { Type } from '@nestjs/common';

/** Builds a controller whose use cases are replaced by `{ execute: vi.fn() }` mocks. */
export async function controllerWithMocks<C>(controller: Type<C>, useCases: Type<unknown>[]) {
  const mocks = new Map(useCases.map((useCase) => [useCase, { execute: vi.fn().mockResolvedValue({ ok: true }) }]));
  const moduleRef = await Test.createTestingModule({
    controllers: [controller],
    providers: [...mocks].map(([provide, useValue]) => ({ provide, useValue })),
  }).compile();
  return {
    controller: moduleRef.get(controller),
    mock: (useCase: Type<unknown>) => mocks.get(useCase)!.execute,
  };
}
