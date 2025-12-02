import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { ArrowLeft, ExternalLink, AlertCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Text } from '@/components/ui/Text';
import { ThemedView } from '@/components/ui/ThemedView';
import { Colors } from '@/constants/Colors';
import { Linking } from 'react-native';

interface Organization {
  id: string;
  name: string;
  terms_and_conditions_url?: string;
  terms_and_conditions_text?: string;
}

export default function TermsAndConditionsScreen() {
  const router = useRouter();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOrganization();
  }, []);

  const loadOrganization = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user's organization
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Please log in to view terms and conditions');
        return;
      }

      // Get user's profile to find organization
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!profile?.organization_id) {
        setError('No organization found for your account');
        return;
      }

      // Get organization details
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id, name, terms_and_conditions_url, terms_and_conditions_text')
        .eq('id', profile.organization_id)
        .single();

      if (orgError) throw orgError;

      if (!org.terms_and_conditions_url && !org.terms_and_conditions_text) {
        setError('Terms and conditions not available for your school');
        return;
      }

      setOrganization(org);
    } catch (err) {
      console.error('Error loading organization:', err);
      setError('Failed to load terms and conditions');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenInBrowser = () => {
    if (organization?.terms_and_conditions_url) {
      Linking.openURL(organization.terms_and_conditions_url);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={Colors.dark.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Terms & Conditions</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.dark.tint} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={Colors.dark.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Terms & Conditions</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <AlertCircle size={48} color={Colors.dark.destructive} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadOrganization} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={Colors.dark.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Terms & Conditions</Text>
        {organization?.terms_and_conditions_url && (
          <TouchableOpacity onPress={handleOpenInBrowser} style={styles.externalButton}>
            <ExternalLink size={20} color={Colors.dark.tint} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.schoolInfo}>
        <Text style={styles.schoolName}>{organization?.name}</Text>
      </View>

      {organization?.terms_and_conditions_url ? (
        <WebView
          source={{ uri: organization.terms_and_conditions_url }}
          style={styles.webview}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.webviewLoading}>
              <ActivityIndicator size="large" color={Colors.dark.tint} />
            </View>
          )}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('WebView error:', nativeEvent);
            Alert.alert(
              'Error',
              'Failed to load terms and conditions. Please try opening in browser.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open in Browser', onPress: handleOpenInBrowser }
              ]
            );
          }}
        />
      ) : organization?.terms_and_conditions_text ? (
        <View style={styles.textContainer}>
          <Text style={styles.termsText}>{organization.terms_and_conditions_text}</Text>
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  backButton: {
    padding: 8,
  },
  externalButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  schoolInfo: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.dark.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  schoolName: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.dark.text,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.dark.tint,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  webview: {
    flex: 1,
  },
  webviewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
  },
  textContainer: {
    flex: 1,
    padding: 16,
  },
  termsText: {
    fontSize: 14,
    lineHeight: 22,
    color: Colors.dark.text,
  },
});
