import { renderHook, act } from '@testing-library/react-hooks';
import { Alert, Linking, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import { usePaymentFlow } from '@/hooks/usePaymentFlow';
import { SA_BANKING_APPS } from '@/lib/payments/bankingApps';

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-intent-launcher', () => ({
  startActivityAsync: jest.fn(),
}));

const flushPromises = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

describe('usePaymentFlow bank launch behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'android';
    (Linking as any).canOpenURL = jest.fn(async () => false);
    (Linking as any).openURL = jest.fn(async () => undefined);
    (Alert.alert as unknown as jest.Mock).mockClear();
    (IntentLauncher.startActivityAsync as jest.Mock).mockResolvedValue({});
  });

  it('returns the full bank catalog even when no app is detected', async () => {
    const { result } = renderHook(() => usePaymentFlow({}));

    await act(async () => {
      await flushPromises();
    });

    expect(result.current.bankApps).toHaveLength(SA_BANKING_APPS.length);
    expect(result.current.bankApps.every((bank) => bank.detected === false)).toBe(true);
    expect(result.current.launchState).toBe('idle');
    expect(result.current.canUploadProof).toBe(false);
  });

  it('marks detected banks when URL schemes can be opened', async () => {
    (Linking.canOpenURL as jest.Mock).mockImplementation(async (scheme: string) =>
      scheme.startsWith('fnbbanking://')
    );

    const { result } = renderHook(() => usePaymentFlow({}));

    await act(async () => {
      await flushPromises();
    });

    const detectedBank = result.current.bankApps.find((bank) => bank.id === 'fnb');
    const undetectedBank = result.current.bankApps.find((bank) => bank.id === 'absa');

    expect(detectedBank?.detected).toBe(true);
    expect(undetectedBank?.detected).toBe(false);
  });

  it('sets launch state to launched when android package launch succeeds', async () => {
    const { result } = renderHook(() => usePaymentFlow({}));

    await act(async () => {
      await flushPromises();
      await result.current.openBankingApp(SA_BANKING_APPS[0]);
    });

    expect(IntentLauncher.startActivityAsync).toHaveBeenCalled();
    expect(result.current.launchState).toBe('launched');
    expect(result.current.canUploadProof).toBe(true);
  });

  it('shows fallback actions and allows manual confirmation when launch fails', async () => {
    (IntentLauncher.startActivityAsync as jest.Mock).mockRejectedValue(new Error('package missing'));
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(false);
    const alertSpy = Alert.alert as unknown as jest.Mock;

    const { result } = renderHook(() => usePaymentFlow({}));

    await act(async () => {
      await flushPromises();
      await result.current.openBankingApp(SA_BANKING_APPS[0]);
    });

    expect(alertSpy).toHaveBeenCalled();

    const buttons = alertSpy.mock.calls[0]?.[2] as Array<{ text?: string; onPress?: () => void }> | undefined;
    const manualButton = buttons?.find((button) => button.text === 'I paid manually');
    expect(manualButton).toBeDefined();

    act(() => {
      manualButton?.onPress?.();
    });

    expect(result.current.launchState).toBe('manual_confirmed');
    expect(result.current.canUploadProof).toBe(true);
  });
});
