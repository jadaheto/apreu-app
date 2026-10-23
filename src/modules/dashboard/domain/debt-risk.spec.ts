import { classifyDebtRisk } from './debt-risk.js';

describe('classifyDebtRisk', () => {
  it.each([
    [0, 'low'],
    [30, 'low'],
    [31, 'medium'],
    [60, 'medium'],
    [61, 'high'],
    [90, 'high'],
    [91, 'critical'],
  ])('%i days → %s', (days, risk) => {
    expect(classifyDebtRisk(days)).toBe(risk);
  });
});
