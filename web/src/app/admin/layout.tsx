'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { Settings, BookMarked, LogOut, Loader2, FileText } from 'lucide-react';
import RegistrationNotifications from '@/components/admin/RegistrationNotifications';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      console.log('[Admin] Checking auth, session:', !!session);
      
      if (!session) {
        console.log('[Admin] No session, redirecting to sign-in');
        router.push('/sign-in');
        return;
      }

      // Check if user is superadmin
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      console.log('[Admin] Profile:', profile, 'Error:', error);

      if (error || profile?.role !== 'superadmin') {
        console.log('[Admin] Not superadmin, redirecting to dashboard');
        alert(`Access Denied: You need superadmin role. Current role: ${profile?.role || 'none'}`);
        router.push('/dashboard');
        return;
      }

      console.log('[Admin] Authorized as superadmin!');
      setAuthorized(true);
    } catch (error) {
      console.error('[Admin] Auth check error:', error);
      alert('Error checking authorization');
      router.push('/sign-in');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/sign-in');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            boxShadow: '0 0 60px rgba(124, 58, 237, 0.6)',
            animation: 'pulse-glow 2s ease-in-out infinite'
          }}>
            <span style={{ fontSize: 48, fontWeight: 'bold', color: 'white' }}>📚</span>
          </div>
          <h2 style={{ color: 'white', fontSize: 24, fontWeight: 700, marginBottom: 8 }}>EduDash Pro</h2>
          <p style={{ color: '#9ca3af', fontSize: 14 }}>Loading your dashboard...</p>
          <style jsx>{`
            @keyframes pulse-glow {
              0%, 100% { 
                transform: scale(1);
                boxShadow: 0 0 60px rgba(124, 58, 237, 0.6);
              }
              50% { 
                transform: scale(1.05);
                boxShadow: 0 0 80px rgba(236, 72, 153, 0.8);
              }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Navigation */}
      <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-8">
              <Link href="/admin" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">SA</span>
                </div>
                <span className="text-xl font-bold text-gray-900 dark:text-white">
                  Superadmin
                </span>
              </Link>

              {/* Navigation Links */}
              <div className="hidden md:flex items-center gap-4">
                <Link
                  href="/admin/registrations"
                  className="flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <FileText className="w-5 h-5" />
                  <span>Registrations</span>
                </Link>
                <Link
                  href="/admin/ai-config"
                  className="flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <Settings className="w-5 h-5" />
                  <span>AI Config</span>
                </Link>
                <Link
                  href="/admin/caps-mapping"
                  className="flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <BookMarked className="w-5 h-5" />
                  <span>CAPS Mapping</span>
                </Link>
              </div>
            </div>

            {/* Right Side - Notifications & Sign Out */}
            <div className="flex items-center gap-4">
              <RegistrationNotifications />
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden md:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
}
