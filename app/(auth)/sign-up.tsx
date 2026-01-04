import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

export default function SignUpAlias() {
  const params = useLocalSearchParams<{ 
    planTier?: string; 
    billing?: 'monthly' | 'annual';
    inviteCode?: string;
  }>();

  useEffect(() => {
    // If there's an invite code, route to role selection or membership registration
    if (params?.inviteCode) {
      // Route directly to membership registration with the invite code
      router.replace({ 
        pathname: '/screens/membership/register' as any, 
        params: { inviteCode: params.inviteCode } 
      } as any);
      return;
    }

    // Forward plan context to role-selection for choosing registration type
    const nextParams: any = {};
    if (params?.planTier) nextParams.planTier = String(params.planTier);
    if (params?.billing) nextParams.billing = params.billing === 'annual' ? 'annual' : 'monthly';

    // Route to role selection for new users without invite codes
    router.replace({ pathname: '/(auth)/role-selection' as any, params: nextParams } as any);
  }, [params?.planTier, params?.billing, params?.inviteCode]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0f' }}>
      <ActivityIndicator color="#00f5ff" />
    </View>
  );
}
