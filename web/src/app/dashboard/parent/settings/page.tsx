'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { ParentShell } from '@/components/dashboard/parent/ParentShell';
import { Settings, User, Bell, Lock, Globe, Moon, Sun, Upload, LogOut, Camera, AlertTriangle, CreditCard, ChevronRight, Phone, Mail, Check, X, Loader2, Users, MessageCircle } from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userEmail, setUserEmail] = useState<string>();
  const [userId, setUserId] = useState<string>();
  const { slug } = useTenantSlug(userId);
  const { profile, loading: profileLoading } = useUserProfile(userId);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  
  // Profile form state
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [whatsappNotifications, setWhatsappNotifications] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  
  // Language preference
  const [language, setLanguage] = useState('en-ZA');
  
  // Linked children
  const [linkedChildren, setLinkedChildren] = useState<any[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(false);
  
  // Password change modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  
  // Avatar upload
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Load profile data directly from database
  useEffect(() => {
    let isMounted = true;
    
    const loadProfileData = async () => {
      if (!userId) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, phone, avatar_url, notification_preferences')
        .eq('id', userId)
        .single();
      
      if (data && !error && isMounted) {
        setFullName(`${data.first_name || ''} ${data.last_name || ''}`.trim());
        setPhoneNumber(data.phone || '');
        setAvatarUrl(data.avatar_url || null);
        
        // Load notification preferences
        const prefs = data.notification_preferences || {};
        setEmailNotifications(prefs.email_notifications !== false);
        setPushNotifications(prefs.push_notifications === true);
        setWhatsappNotifications(prefs.whatsapp_notifications === true);
        setLanguage(prefs.language || 'en-ZA');
        setDarkMode(prefs.dark_mode !== false);
      }
    };
    
    loadProfileData();
    
    // Reload when page becomes visible (user navigates back)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadProfileData();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userId, supabase]);
  
  // Load linked children
  useEffect(() => {
    const loadLinkedChildren = async () => {
      if (!userId) return;
      
      setLoadingChildren(true);
      try {
        const { data, error } = await supabase
          .from('students')
          .select('id, first_name, last_name, grade, class:classes(name)')
          .eq('parent_id', userId);
        
        if (data && !error) {
          setLinkedChildren(data);
        }
      } catch (err) {
        console.error('Failed to load children:', err);
      } finally {
        setLoadingChildren(false);
      }
    };
    
    loadLinkedChildren();
  }, [userId, supabase]);
  
  // Save notification preferences
  const saveNotificationPreferences = async () => {
    if (!userId) return;
    
    try {
      setSavingPreferences(true);
      
      const { error } = await supabase
        .from('profiles')
        .update({
          notification_preferences: {
            email_notifications: emailNotifications,
            push_notifications: pushNotifications,
            whatsapp_notifications: whatsappNotifications,
            language: language,
            dark_mode: darkMode,
          }
        })
        .eq('id', userId);
      
      if (error) throw error;
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error: any) {
      console.error('Failed to save preferences:', error);
      setSaveError(error.message || 'Failed to save preferences');
    } finally {
      setSavingPreferences(false);
    }
  };
  
  // Handle dark mode toggle with persistence
  const handleDarkModeToggle = async () => {
    const newValue = !darkMode;
    setDarkMode(newValue);
    
    // Apply to document
    if (newValue) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Save to database
    if (userId) {
      await supabase
        .from('profiles')
        .update({
          notification_preferences: {
            email_notifications: emailNotifications,
            push_notifications: pushNotifications,
            whatsapp_notifications: whatsappNotifications,
            language: language,
            dark_mode: newValue,
          }
        })
        .eq('id', userId);
    }
  };
  
  // Handle language change with persistence
  const handleLanguageChange = async (newLanguage: string) => {
    setLanguage(newLanguage);
    
    // Save to database
    if (userId) {
      await supabase
        .from('profiles')
        .update({
          notification_preferences: {
            email_notifications: emailNotifications,
            push_notifications: pushNotifications,
            whatsapp_notifications: whatsappNotifications,
            language: newLanguage,
            dark_mode: darkMode,
          }
        })
        .eq('id', userId);
        
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };
  
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;
    
    // Validate file
    if (file.size > 2 * 1024 * 1024) {
      setSaveError('Image must be less than 2MB');
      return;
    }
    
    if (!file.type.startsWith('image/')) {
      setSaveError('Please upload an image file');
      return;
    }
    
    try {
      setUploadingAvatar(true);
      setSaveError(null);
      
      // Upload to Supabase storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
      
      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);
      
      if (updateError) throw updateError;
      
      setAvatarUrl(publicUrl);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error: any) {
      console.error('Avatar upload failed:', error);
      setSaveError(error.message || 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };
  
  const handleSaveProfile = async () => {
    if (!userId) return;
    
    try {
      setSaving(true);
      setSaveError(null);
      
      // Split full name into first and last name
      const nameParts = fullName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: firstName,
          last_name: lastName,
          phone: phoneNumber.trim(),
        })
        .eq('id', userId);
      
      if (error) throw error;
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error: any) {
      console.error('Save failed:', error);
      setSaveError(error.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };
  
  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    
    try {
      setChangingPassword(true);
      setPasswordError(null);
      
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      
      if (error) throw error;
      
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error: any) {
      console.error('Password change failed:', error);
      setPasswordError(error.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleAvatarUpload(event);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push('/sign-in');
  };

  const handleDeleteAccount = async () => {
    const confirmed = typeof window !== 'undefined'
      ? window.confirm('Are you sure you want to permanently delete your EduDash Pro account? This action cannot be undone and will remove access immediately.')
      : false;

    if (!confirmed) return;

    try {
      setDeletingAccount(true);
      setDeleteError(null);

      const { data, error } = await supabase.functions.invoke('delete-account', {
        method: 'POST',
        body: { confirm: true },
      });

      if (error || !data?.success) {
        throw error ?? new Error('Failed to delete account');
      }

      await supabase.auth.signOut();
      router.push('/sign-in?accountDeleted=1');
    } catch (err) {
      console.error('[ParentSettings] delete account failed', err);
      setDeleteError('We could not delete your account right now. Please try again or contact support.');
    } finally {
      setDeletingAccount(false);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/sign-in');
        return;
      }

      setUserEmail(session.user.email);
      setUserId(session.user.id);
      setLoading(false);
    };

    initAuth();
  }, [router, supabase]);

  if (loading) {
    return (
      <div className="app">
        <header className="topbar">
          <div className="container topbarRow">
            <div className="brand">EduDash Pro</div>
          </div>
        </header>
        <main className="content container">
          Loading...
        </main>
      </div>
    );
  }

  return (
    <ParentShell tenantSlug={slug} userEmail={userEmail}>
      <div className="container">
        {/* Success notification banner */}
        {saveSuccess && (
          <div style={{
            position: 'fixed',
            top: 80,
            right: 20,
            background: 'var(--success)',
            color: 'white',
            padding: '12px 20px',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: 'var(--shadow-lg)',
            zIndex: 1000,
            animation: 'slideIn 0.3s ease-out'
          }}>
            <Check className="icon16" />
            <span>Settings saved successfully!</span>
          </div>
        )}
        
        <div className="section">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
            <button
              onClick={() => router.back()}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                padding: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-2)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>
            <div>
              <h1 className="h1" style={{ marginBottom: 0 }}>Settings</h1>
              <p className="muted">Manage your account preferences</p>
            </div>
          </div>
        </div>

        <div className="section">
          <div style={{ maxWidth: 800, display: 'grid', gap: 'var(--space-4)' }}>

            {/* Profile Settings */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                <User className="icon20" style={{ color: 'var(--primary)' }} />
                <h2 className="h2" style={{ margin: 0 }}>Profile</h2>
              </div>
              <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                {/* Profile Picture */}
                <div>
                  <label className="label">Profile Picture</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                    <div style={{ position: 'relative' }}>
                      {uploadingAvatar ? (
                        <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center">
                          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        </div>
                      ) : avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt="Profile"
                          style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }}
                        />
                      ) : (
                        <div className="avatar" style={{ width: 80, height: 80, fontSize: 28, border: '2px solid var(--primary)' }}>
                          {fullName?.[0]?.toUpperCase() || userEmail?.[0]?.toUpperCase() || 'U'}
                        </div>
                      )}
                      <label style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        width: 28,
                        height: 28,
                        background: 'var(--primary)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: uploadingAvatar ? 'not-allowed' : 'pointer',
                        boxShadow: 'var(--shadow-md)',
                        opacity: uploadingAvatar ? 0.5 : 1
                      }}>
                        <Camera className="icon16" style={{ color: 'white' }} />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          style={{ display: 'none' }}
                          disabled={uploadingAvatar}
                        />
                      </label>
                    </div>
                    <div>
                      <p style={{ fontSize: 14, marginBottom: 4 }}>Upload a profile picture</p>
                      <p className="muted" style={{ fontSize: 12 }}>JPG, PNG or GIF (Max 2MB)</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="label">
                    <Mail className="icon16" style={{ marginRight: 'var(--space-1)', display: 'inline-block', verticalAlign: 'middle' }} />
                    Email
                  </label>
                  <input
                    type="email"
                    value={userEmail}
                    disabled
                    className="input"
                    style={{ opacity: 0.6, cursor: 'not-allowed' }}
                  />
                </div>

                <div>
                  <label className="label">Full Name</label>
                  <input
                    type="text"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="input"
                  />
                </div>
                
                <div>
                  <label className="label">
                    <Phone className="icon16" style={{ marginRight: 'var(--space-1)', display: 'inline-block', verticalAlign: 'middle' }} />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +27 82 123 4567"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="input"
                  />
                  <p className="muted" style={{ fontSize: 12, marginTop: 'var(--space-1)' }}>Used for notifications and account recovery</p>
                </div>
                
                {saveError && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', display: 'flex', alignItems: 'start', gap: 'var(--space-2)' }}>
                    <X className="icon16" style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 2 }} />
                    <p style={{ fontSize: 14, color: 'var(--danger)' }}>{saveError}</p>
                  </div>
                )}

                <button 
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="btn btnPrimary" 
                  style={{ width: 'fit-content', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
                >
                  {saving && <Loader2 className="icon16 animate-spin" />}
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
            
            {/* Success Banner */}
            {saveSuccess && (
              <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 50, background: 'var(--success)', color: 'white', padding: '12px 24px', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', animation: 'slideIn 0.3s ease-out' }}>
                <Check className="icon16" />
                <span>Changes saved successfully!</span>
              </div>
            )}

            {/* Notifications */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                <Bell className="icon20" style={{ color: 'var(--primary)' }} />
                <h2 className="h2" style={{ margin: 0 }}>Notifications</h2>
              </div>
              <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                <div className="listItem">
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Email Notifications</div>
                    <div className="muted" style={{ fontSize: 12 }}>Receive updates via email</div>
                  </div>
                  <button 
                    onClick={() => setEmailNotifications(!emailNotifications)}
                    className={`toggle ${emailNotifications ? 'toggleActive' : ''}`}
                  >
                    <span className="toggleThumb" style={{ transform: emailNotifications ? 'translateX(20px)' : 'translateX(0)' }} />
                  </button>
                </div>
                <div className="listItem">
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Push Notifications</div>
                    <div className="muted" style={{ fontSize: 12 }}>Receive push notifications</div>
                  </div>
                  <button 
                    onClick={() => setPushNotifications(!pushNotifications)}
                    className={`toggle ${pushNotifications ? 'toggleActive' : ''}`}
                  >
                    <span className="toggleThumb" style={{ transform: pushNotifications ? 'translateX(20px)' : 'translateX(0)' }} />
                  </button>
                </div>
                <div className="listItem">
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>WhatsApp Notifications</div>
                    <div className="muted" style={{ fontSize: 12 }}>Receive updates via WhatsApp</div>
                  </div>
                  <button 
                    onClick={() => setWhatsappNotifications(!whatsappNotifications)}
                    className={`toggle ${whatsappNotifications ? 'toggleActive' : ''}`}
                  >
                    <span className="toggleThumb" style={{ transform: whatsappNotifications ? 'translateX(20px)' : 'translateX(0)' }} />
                  </button>
                </div>
                
                {/* Call Ringtones Link */}
                <div 
                  className="listItem" 
                  style={{ cursor: 'pointer', background: 'var(--surface-variant)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}
                  onClick={() => router.push('/dashboard/parent/settings/ringtones')}
                >
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <Phone className="icon16" />
                      Call Ringtones
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>Customize ringtones and call sounds</div>
                  </div>
                  <ChevronRight className="icon16" style={{ color: 'var(--muted)' }} />
                </div>
              </div>
              <button 
                onClick={saveNotificationPreferences}
                disabled={savingPreferences}
                className="btn btnSecondary" 
                style={{ marginTop: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', opacity: savingPreferences ? 0.6 : 1 }}
              >
                {savingPreferences && <Loader2 className="icon16 animate-spin" />}
                {savingPreferences ? 'Saving...' : 'Save Notification Preferences'}
              </button>
            </div>

            {/* Linked Children */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <Users className="icon20" style={{ color: 'var(--primary)' }} />
                  <h2 className="h2" style={{ margin: 0 }}>Linked Children</h2>
                </div>
                <button 
                  onClick={() => router.push('/dashboard/parent/register-child')}
                  className="btn btnSmall btnPrimary"
                >
                  Add Child
                </button>
              </div>
              {loadingChildren ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
                  <Loader2 className="icon20 animate-spin" style={{ color: 'var(--muted)' }} />
                </div>
              ) : linkedChildren.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-4)', color: 'var(--muted)' }}>
                  <p>No children linked to your account yet.</p>
                  <button 
                    onClick={() => router.push('/dashboard/parent/register-child')}
                    className="btn btnPrimary"
                    style={{ marginTop: 'var(--space-3)' }}
                  >
                    Register a Child
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                  {linkedChildren.map((child) => (
                    <div key={child.id} className="listItem" style={{ cursor: 'pointer' }} onClick={() => router.push(`/dashboard/parent/children/${child.id}`)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div className="avatar" style={{ width: 40, height: 40, fontSize: 14 }}>
                          {child.first_name?.[0]}{child.last_name?.[0]}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, marginBottom: 2 }}>{child.first_name} {child.last_name}</div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {child.grade || 'No grade'} {child.class?.name ? `• ${child.class.name}` : ''}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="icon20" style={{ color: 'var(--textMuted)' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Subscription & Billing */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                <CreditCard className="icon20" style={{ color: 'var(--primary)' }} />
                <h2 className="h2" style={{ margin: 0 }}>Subscription & Billing</h2>
              </div>
              <div className="listItem" style={{ cursor: 'pointer' }} onClick={() => router.push('/dashboard/parent/subscription')}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Manage Subscription</div>
                  <div className="muted" style={{ fontSize: 12 }}>View your plan, usage, and upgrade options</div>
                </div>
                <ChevronRight className="icon20" style={{ color: 'var(--textMuted)' }} />
              </div>
            </div>

            {/* Appearance */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                {darkMode ? (
                  <Moon className="icon20" style={{ color: 'var(--primary)' }} />
                ) : (
                  <Sun className="icon20" style={{ color: 'var(--primary)' }} />
                )}
                <h2 className="h2" style={{ margin: 0 }}>Appearance</h2>
              </div>
              <div className="listItem">
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Dark Mode</div>
                  <div className="muted" style={{ fontSize: 12 }}>Toggle dark mode</div>
                </div>
                <button
                  onClick={handleDarkModeToggle}
                  className={`toggle ${darkMode ? 'toggleActive' : ''}`}
                >
                  <span
                    className="toggleThumb"
                    style={{ transform: darkMode ? 'translateX(20px)' : 'translateX(0)' }}
                  />
                </button>
              </div>
            </div>

            {/* Language */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                <Globe className="icon20" style={{ color: 'var(--primary)' }} />
                <h2 className="h2" style={{ margin: 0 }}>Language</h2>
              </div>
              <select 
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="input"
              >
                <option value="en-ZA">English (South Africa)</option>
                <option value="af-ZA">Afrikaans</option>
                <option value="zu-ZA">Zulu</option>
                <option value="xh-ZA">Xhosa</option>
                <option value="st-ZA">Sesotho</option>
                <option value="tn-ZA">Setswana</option>
              </select>
            </div>

            {/* Security */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                <Lock className="icon20" style={{ color: 'var(--primary)' }} />
                <h2 className="h2" style={{ margin: 0 }}>Security</h2>
              </div>
              <button 
                onClick={() => setShowPasswordModal(true)}
                className="btn btnSecondary" 
                style={{ width: '100%', justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
              >
                <span>Change Password</span>
                <Lock className="icon16" style={{ marginLeft: 'auto', color: 'var(--textMuted)' }} />
              </button>
            </div>

            {/* Sign Out */}
            <div className="card" style={{ borderColor: 'var(--danger-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                <LogOut className="icon20" style={{ color: 'var(--danger)' }} />
                <h2 className="h2" style={{ margin: 0 }}>Sign Out</h2>
              </div>
              <p className="muted" style={{ marginBottom: 'var(--space-3)' }}>
                Sign out from your account on this device.
              </p>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="btn"
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  color: 'white',
                  opacity: signingOut ? 0.5 : 1,
                  cursor: signingOut ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--space-2)'
                }}
              >
                <LogOut className="icon16" />
                {signingOut ? 'Signing out...' : 'Sign Out'}
              </button>
            </div>

            {/* Delete Account */}
            <div className="card p-md border-2 border-red-800/40 bg-red-950/20">
              <div className="flex items-center gap-3 mb-6">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <h2 className="text-lg font-semibold text-red-200">Delete Account</h2>
              </div>
              <p className="text-sm text-red-200/80 mb-3">
                Permanently delete your EduDash Pro account, remove access to all Dash AI features, and end your subscription. This cannot be undone.
              </p>
              <ul className="text-xs text-red-100/70 mb-4 space-y-1 list-disc list-inside">
                <li>All devices will be signed out immediately</li>
                <li>Your subscription and trial benefits will stop</li>
                <li>Some records may be retained for regulatory requirements</li>
              </ul>
              {deleteError && (
                <div className="mb-3 rounded-md border border-red-500/50 bg-red-900/40 px-3 py-2 text-xs text-red-100">
                  {deleteError}
                </div>
              )}
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
                className="w-full px-4 py-3 bg-gradient-to-r from-red-700 to-red-800 hover:from-red-800 hover:to-red-900 disabled:from-gray-700 disabled:to-gray-700 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 disabled:cursor-not-allowed shadow-lg hover:shadow-red-700/40"
              >
                <AlertTriangle className="w-4 h-4" />
                {deletingAccount ? 'Deleting account?' : 'Delete My Account'}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Password Change Modal */}
      {showPasswordModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: 'var(--cardBg)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-2xl)', maxWidth: 480, width: '100%', padding: 24, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h3 style={{ fontSize: 20, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Lock className="icon20" style={{ color: 'var(--primary)' }} />
                Change Password
              </h3>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordError(null);
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                style={{ color: 'var(--textMuted)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                <X className="icon20" />
              </button>
            </div>
            
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label className="label">New Password</label>
                <input
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input"
                />
              </div>
              
              <div>
                <label className="label">Confirm Password</label>
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input"
                />
              </div>
              
              {passwordError && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', padding: 12, display: 'flex', alignItems: 'start', gap: 8 }}>
                  <X className="icon16" style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 2 }} />
                  <p style={{ fontSize: 14, color: 'var(--danger)' }}>{passwordError}</p>
                </div>
              )}
              
              <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordError(null);
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="btn btnSecondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  onClick={handlePasswordChange}
                  disabled={changingPassword || !newPassword || !confirmPassword}
                  className="btn btnPrimary"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: (changingPassword || !newPassword || !confirmPassword) ? 0.6 : 1, cursor: (changingPassword || !newPassword || !confirmPassword) ? 'not-allowed' : 'pointer' }}
                >
                  {changingPassword && <Loader2 className="icon16 animate-spin" />}
                  {changingPassword ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ParentShell>
  );
}
