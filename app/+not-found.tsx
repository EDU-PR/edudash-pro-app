import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Stack, useRouter, useSegments, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { COMMUNITY_SCHOOL_ID } from '@/lib/routeAfterLogin';
import { logger } from '@/lib/logger';

const TAG = 'NotFound';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
// Auto-redirect delay (in ms) - reduced for better UX
const AUTO_REDIRECT_DELAY = 300;

// Time to show loading spinner before showing actual not-found content
const SHOW_NOT_FOUND_DELAY = 2000;

/** Debug information for route not found */
interface DebugInfo {
  pathname: string;
  segments: string[];
  canGoBack: boolean;
  userRole: string;
  isAuthenticated: boolean;
  windowLocation: string;
  timestamp: string;
}

export default function NotFound() {
  const { t } = useTranslation();
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const { user, profile, loading: authLoading } = useAuth();
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [showNotFoundContent, setShowNotFoundContent] = useState(false);
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notFoundTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Smart fallback navigation based on user state
  const getSmartFallback = () => {
    if (!user) return '/(auth)/sign-in';

    const k12Types = new Set(['k12', 'k12_school', 'combined', 'primary', 'secondary', 'community_school']);
    const schoolType = profile?.organization_membership?.school_type;
    const isCommunitySchool = profile?.organization_id === COMMUNITY_SCHOOL_ID;
    const normalizedSchoolType = schoolType ? String(schoolType).toLowerCase() : undefined;
    const isK12 = normalizedSchoolType ? k12Types.has(normalizedSchoolType) : isCommunitySchool;
    
    // Route based on user role
    switch (profile?.role) {
      case 'super_admin':
      case 'superadmin':
        return '/screens/super-admin-dashboard';
      case 'principal':
      case 'principal_admin':
        return '/screens/principal-dashboard';
      case 'teacher':
        return '/screens/teacher-dashboard';
      case 'student':
      case 'learner':
        return isK12 ? '/(k12)/student/dashboard' : '/screens/learner-dashboard';
      case 'parent':
      default:
        return isK12 ? '/(k12)/parent/dashboard' : '/screens/parent-dashboard';
    }
  };
  
  // Auto-redirect after auth loads - prevents "Route Not Found" flash
  useEffect(() => {
    // Don't redirect while auth is still loading
    if (authLoading) return;
    
    // Clear any existing timeout
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
    }
    
    // Set up auto-redirect with a short delay (allows route to resolve first)
    redirectTimeoutRef.current = setTimeout(() => {
      setIsRedirecting(true);
      const targetRoute = getSmartFallback();
      
      if (__DEV__) {
        logger.debug(TAG, 'Auto-redirecting to:', targetRoute, 'from:', pathname);
      }
      
      router.replace(targetRoute as any);
    }, AUTO_REDIRECT_DELAY);
    
    // Only show the actual "not found" UI after a longer delay
    // This prevents flash during normal navigation
    notFoundTimeoutRef.current = setTimeout(() => {
      setShowNotFoundContent(true);
    }, SHOW_NOT_FOUND_DELAY);
    
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
      if (notFoundTimeoutRef.current) {
        clearTimeout(notFoundTimeoutRef.current);
      }
    };
  }, [authLoading, user, profile?.role, pathname]);
  
  useEffect(() => {
    // Gather debug information
    const gatherDebugInfo = () => {
      try {
        const canGo = typeof router.canGoBack === 'function' ? router.canGoBack() : false;
        setCanGoBack(canGo);
        
        const info = {
          pathname,
          segments,
          canGoBack: canGo,
          userRole: profile?.role || 'unknown',
          isAuthenticated: !!user,
          windowLocation: typeof window !== 'undefined' ? window.location.href : 'N/A',
          timestamp: new Date().toISOString(),
        };
        
        setDebugInfo(info);
        
        if (__DEV__) {
          console.warn('🚨 [NOT-FOUND] Unmatched route detected:', info);
        }
      } catch (error) {
        console.error('🚨 [NOT-FOUND] Error gathering debug info:', error);
      }
    };
    
    gatherDebugInfo();
  }, [pathname, segments, user, profile, router]);
  
  // Show loading state while auth is resolving, redirecting, or before showing not-found content
  if (authLoading || isRedirecting || !showNotFoundContent) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={['#0a0a0f', '#0f172a', '#0a0a0f']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="school" size={48} color="#00f5ff" />
          </View>
          <Text style={styles.logoText}>EduDash Pro</Text>
          <Text style={styles.logoSubtext}>Empowering Education Through AI</Text>
        </View>
        
        {/* Loading spinner */}
        <View style={styles.spinnerContainer}>
          <EduDashSpinner size="large" color="#00f5ff" />
          <Text style={styles.loadingText}>
            {authLoading 
              ? t('common.loading', { defaultValue: 'Loading your dashboard...' }) 
              : t('common.redirecting', { defaultValue: 'Navigating...' })}
          </Text>
        </View>
      </View>
    );
  }
  
  const handleSmartBack = () => {
    try {
      if (canGoBack) {
        router.back();
      } else {
        const fallback = getSmartFallback();
        router.replace(fallback as `/${string}`);
      }
    } catch (error) {
      console.error('Smart back navigation failed:', error);
      router.replace('/');
    }
  };

  const handleGoToDashboard = () => {
    setIsRedirecting(true);
    const fallback = getSmartFallback();
    router.replace(fallback as `/${string}`);
  };

  return (
    <>
      <Stack.Screen options={{ title: t('not_found.title', { defaultValue: 'Route Not Found' }), headerShown: false }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="warning" size={64} color="#ff6b6b" />
          <Text style={styles.title}>{t('not_found.title', { defaultValue: 'Route Not Found' })}</Text>
          <Text style={styles.subtitle}>{t('not_found.subtitle', { defaultValue: "The requested page doesn't exist in the app." })}</Text>
        </View>

        {/* Navigation Options */}
        <View style={styles.actions}>
          {canGoBack ? (
            <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={handleSmartBack}>
              <Ionicons name="arrow-back" size={20} color="#000" style={styles.buttonIcon} />
              <Text style={styles.buttonText}>{t('navigation.back', { defaultValue: 'Back' })}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={handleGoToDashboard}>
              <Ionicons name="home" size={20} color="#000" style={styles.buttonIcon} />
              <Text style={styles.buttonText}>{t('not_found.go_to_dashboard', { defaultValue: 'Go to Dashboard' })}</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => router.replace('/')}>
            <Ionicons name="planet" size={20} color="#00f5ff" style={styles.buttonIcon} />
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>{t('not_found.go_to_home', { defaultValue: 'Go to Home' })}</Text>
          </TouchableOpacity>
        </View>

        {/* Debug Information (Development Only) */}
        {__DEV__ && debugInfo && (
          <View style={styles.debugSection}>
            <Text style={styles.debugTitle}>{t('not_found.debug.title', { defaultValue: 'Debug Information' })}</Text>
            <View style={styles.debugCard}>
              <Text style={styles.debugInfo}>{t('not_found.debug.path', { defaultValue: 'Path' })}: {debugInfo.pathname}</Text>
              <Text style={styles.debugInfo}>{t('not_found.debug.user_role', { defaultValue: 'User Role' })}: {debugInfo.userRole}</Text>
              <Text style={styles.debugInfo}>{t('not_found.debug.authenticated', { defaultValue: 'Authenticated' })}: {debugInfo.isAuthenticated ? t('common.yes', { defaultValue: 'Yes' }) : t('common.no', { defaultValue: 'No' })}</Text>
              <Text style={styles.debugInfo}>{t('not_found.debug.can_go_back', { defaultValue: 'Can Go Back' })}: {debugInfo.canGoBack ? t('common.yes', { defaultValue: 'Yes' }) : t('common.no', { defaultValue: 'No' })}</Text>
              <Text style={styles.debugInfo}>{t('not_found.debug.segments', { defaultValue: 'Segments' })}: {JSON.stringify(debugInfo.segments)}</Text>
              <Text style={styles.debugInfoSmall}>{t('not_found.debug.timestamp', { defaultValue: 'Timestamp' })}: {debugInfo.timestamp}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(0, 245, 255, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(0, 245, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  logoSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
  },
  spinnerContainer: {
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    minHeight: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 8,
  },
  actions: {
    width: '100%',
    maxWidth: 320,
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#00f5ff',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#00f5ff',
  },
  buttonIcon: {
    marginRight: 4,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  secondaryButtonText: {
    color: '#00f5ff',
  },
  debugSection: {
    marginTop: 32,
    width: '100%',
    maxWidth: 400,
  },
  debugTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  debugCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  debugInfo: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 6,
    fontFamily: 'monospace',
  },
  debugInfoSmall: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    fontFamily: 'monospace',
  },
});
