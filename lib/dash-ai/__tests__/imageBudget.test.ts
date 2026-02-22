jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  consumeAutoScanBudget,
  FREE_AUTO_SCAN_BUDGET_PER_DAY,
  PAID_AUTO_SCAN_BUDGET_PER_DAY,
  loadAutoScanBudget,
  trackAutoScanUsage,
} from '../imageBudget';

describe('imageBudget auto scanner limits', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('loads free tier auto scan budget with 3/day default', async () => {
    const budget = await loadAutoScanBudget('free');
    expect(budget.totalCount).toBe(FREE_AUTO_SCAN_BUDGET_PER_DAY);
    expect(budget.remainingCount).toBe(FREE_AUTO_SCAN_BUDGET_PER_DAY);
  });

  it('loads paid tier auto scan budget with 7/day default', async () => {
    const budget = await loadAutoScanBudget('starter');
    expect(budget.totalCount).toBe(PAID_AUTO_SCAN_BUDGET_PER_DAY);
    expect(budget.remainingCount).toBe(PAID_AUTO_SCAN_BUDGET_PER_DAY);
  });

  it('tracks and clamps auto scan usage to daily tier limit', async () => {
    await trackAutoScanUsage('free', 2);
    await trackAutoScanUsage('free', 10);
    const budget = await loadAutoScanBudget('free');
    expect(budget.usedCount).toBe(FREE_AUTO_SCAN_BUDGET_PER_DAY);
    expect(budget.remainingCount).toBe(0);
  });

  it('keeps auto scan budgets isolated per user', async () => {
    await trackAutoScanUsage('free', 2, 'user_a');
    await trackAutoScanUsage('free', 1, 'user_b');

    const budgetA = await loadAutoScanBudget('free', 'user_a');
    const budgetB = await loadAutoScanBudget('free', 'user_b');

    expect(budgetA.usedCount).toBe(2);
    expect(budgetB.usedCount).toBe(1);
    expect(budgetA.remainingCount).toBe(FREE_AUTO_SCAN_BUDGET_PER_DAY - 2);
    expect(budgetB.remainingCount).toBe(FREE_AUTO_SCAN_BUDGET_PER_DAY - 1);
  });

  it('atomically consumes scan budget without overshooting daily limit', async () => {
    const consumeAttempts = await Promise.all(
      Array.from({ length: FREE_AUTO_SCAN_BUDGET_PER_DAY + 2 }).map(() =>
        consumeAutoScanBudget('free', 1, 'race_user')
      )
    );
    const allowedCount = consumeAttempts.filter((attempt) => attempt.allowed).length;
    expect(allowedCount).toBe(FREE_AUTO_SCAN_BUDGET_PER_DAY);

    const finalBudget = await loadAutoScanBudget('free', 'race_user');
    expect(finalBudget.usedCount).toBe(FREE_AUTO_SCAN_BUDGET_PER_DAY);
    expect(finalBudget.remainingCount).toBe(0);
  });
});
