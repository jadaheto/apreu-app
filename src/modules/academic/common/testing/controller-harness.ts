import { Test } from '@nestjs/testing';

// oxlint-disable-next-line typescript/no-explicit-any
type UseCaseClass = abstract new (...args: any[]) => { execute: (...args: any[]) => unknown };

/**
 * Compiles a controller whose use cases are `vi.fn()` doubles resolving to
 * `{ ok: true }`. Returns the controller and the double of each use case.
 */
export const buildController = async <C>(
  controller: new (...args: never[]) => C,
  useCases: readonly UseCaseClass[],
): Promise<{ controller: C; mocks: Map<UseCaseClass, { execute: ReturnType<typeof vi.fn> }> }> => {
  const mocks = new Map(useCases.map((useCase) => [useCase, { execute: vi.fn().mockResolvedValue({ ok: true }) }]));
  const moduleRef = await Test.createTestingModule({
    controllers: [controller],
    providers: [...mocks].map(([provide, useValue]) => ({ provide, useValue })),
  }).compile();
  return { controller: moduleRef.get(controller), mocks };
};
