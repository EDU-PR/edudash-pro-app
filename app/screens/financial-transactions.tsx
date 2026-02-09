import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SimpleHeader } from '@/components/ui/SimpleHeader';
import { useTheme } from '@/contexts/ThemeContext';
import EduDashSpinner from '@/components/ui/EduDashSpinner';

export default function FinancialTransactionsRedirect() {
  const router = useRouter();
  const { theme } = useTheme();

  React.useEffect(() => {
    router.replace('/screens/finance-control-center?tab=collections' as any);
  }, [router]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <SimpleHeader title="Financial Transactions" />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <EduDashSpinner size="large" color={theme.primary} />
      </View>
    </SafeAreaView>
  );
}
