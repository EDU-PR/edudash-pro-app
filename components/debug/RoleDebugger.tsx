import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';
import { isSuperAdmin, getRoleDisplayName } from '@/lib/roleUtils';

/**
 * Debug component to help diagnose and fix role issues in development
 * Add this temporarily to any screen to debug role problems
 */
export function RoleDebugger() {
  const { user, profile, refreshProfile } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);

  const handleForceRefresh = async () => {
    try {
      setLoading(true);
      await refreshProfile();
      Alert.alert('Success', 'Profile refreshed successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to refresh profile');
      console.error('Profile refresh error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMakeSuperAdmin = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'No user found');
      return;
    }

    Alert.alert(
      'Confirm Role Change',
      'This will update your role to super_admin. This should only be done in development. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              
              console.log('🔧 Attempting to update role for user:', user.id);
              
              // Update the role in the database
              const { error, data } = await assertSupabase()
                .from('profiles')
                .update({
                  role: 'super_admin',
                  updated_at: new Date().toISOString()
                })
                .eq('id', user.id)
                .select();

              console.log('🔧 Update result:', { error, data });

              if (error) {
                console.error('🔧 Database update error:', error);
                throw new Error(`Database error: ${error.message} (Code: ${error.code})`);
              }

              if (!data || data.length === 0) {
                throw new Error('No rows were updated. User profile may not exist.');
              }

              console.log('🔧 Role updated successfully, refreshing profile...');
              
              // Refresh the profile
              await refreshProfile();

              Alert.alert(
                'Success', 
                'Role updated to super_admin successfully! The page should now show the SuperAdmin dashboard.',
                [{ text: 'OK', onPress: () => {
                  // Force a page refresh
                  if (typeof window !== 'undefined') {
                    window.location.reload();
                  }
                }}]
              );
              
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
              console.error('🔧 Role update failed:', error);
              Alert.alert(
                'Error', 
                `Failed to update role: ${errorMessage}\n\nYou may need to update the role manually in the database or check RLS policies.`,
                [{ text: 'OK' }]
              );
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  if (!__DEV__) {
    // Only show in development
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.title, { color: theme.text }]}>🔧 Role Debugger (DEV ONLY)</Text>
      
      <View style={styles.info}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>User ID:</Text>
        <Text style={[styles.value, { color: theme.text }]}>{user?.id || 'None'}</Text>
      </View>

      <View style={styles.info}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>Email:</Text>
        <Text style={[styles.value, { color: theme.text }]}>{user?.email || 'None'}</Text>
      </View>

      <View style={styles.info}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>Current Role:</Text>
        <Text style={[styles.value, { color: theme.text }]}>
          {profile?.role || 'None'} ({getRoleDisplayName(profile?.role)})
        </Text>
      </View>

      <View style={styles.info}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>Is Super Admin:</Text>
        <Text style={[styles.value, { color: isSuperAdmin(profile?.role) ? theme.success : theme.error }]}>
          {isSuperAdmin(profile?.role) ? '✅ Yes' : '❌ No'}
        </Text>
      </View>

      <View style={styles.info}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>Organization:</Text>
        <Text style={[styles.value, { color: theme.text }]}>{profile?.organization_id || 'None'}</Text>
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={handleForceRefresh}
          disabled={loading}
        >
          <Text style={[styles.buttonText, { color: theme.onPrimary }]}>
            {loading ? '⏳ Refreshing...' : '🔄 Refresh Profile'}
          </Text>
        </TouchableOpacity>

        {!isSuperAdmin(profile?.role) && (
          <>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.error }]}
              onPress={handleMakeSuperAdmin}
              disabled={loading}
            >
              <Text style={[styles.buttonText, { color: theme.onError }]}>
                {loading ? '⏳ Updating...' : '⚡ Make Super Admin'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.warning || theme.surface, borderWidth: 1, borderColor: theme.warning || theme.primary }]}
              onPress={() => {
                const sqlQuery = `UPDATE profiles SET role = 'super_admin', updated_at = NOW() WHERE id = '${user?.id}';`;
                Alert.alert(
                  'Manual SQL Query',
                  'If the automatic update fails, run this SQL query in your Supabase dashboard:\n\n' + sqlQuery,
                  [
                    { text: 'Copy to Clipboard', onPress: () => {
                      if (typeof navigator !== 'undefined' && navigator.clipboard) {
                        navigator.clipboard.writeText(sqlQuery);
                        Alert.alert('Copied', 'SQL query copied to clipboard');
                      }
                    }},
                    { text: 'OK' }
                  ]
                );
              }}
            >
              <Text style={[styles.buttonText, { color: theme.warning || theme.primary }]}>
                📋 Show Manual SQL
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <Text style={[styles.warning, { color: theme.error }]}>
        ⚠️ This component is for development only and will not appear in production builds.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  info: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    flex: 1,
    textAlign: 'right',
  },
  buttons: {
    gap: 8,
    marginTop: 12,
  },
  button: {
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  warning: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
});