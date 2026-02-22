jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
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
});
