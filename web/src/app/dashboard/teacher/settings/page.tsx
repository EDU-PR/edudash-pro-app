'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { User, Bell, Lock, Globe, Moon, LogOut, Camera, Phone, Mail, Check, X, Loader2, ChevronRight } from 'lucide-react';

export default function TeacherSettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userEmail, setUserEmail] = useState<string>();
  const [userId, setUserId] = useState<string>();
  const { slug } = useTenantSlug(userId);
  const { profile, loading: profileLoading } = useUserProfile(userId);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  
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
  
  // Language preference
  const [language, setLanguage] = useState('en-ZA');
  
  // Password change modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  
  // Avatar upload
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
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
  
  // Load profile data
  useEffect(() => {
    const loadProfileData = async () => {
      if (!userId) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, phone, avatar_url')
        .eq('id', userId)
        .single();
      
      if (data && !error) {
        setFullName(data.full_name || '');
        setPhoneNumber(data.phone || '');
        setAvatarUrl(data.avatar_url || null);
      }
    };
    
    loadProfileData();
  }, [userId, supabase]);
  
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
      
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
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

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push('/sign-in');
  };

  // Toggle component for better UX
  const Toggle = ({ enabled, onChange }: { enabled: boolean; onChange: () => void }) => (
    <button
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 ${
        enabled ? 'bg-purple-600' : 'bg-gray-600'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          <p className="text-gray-400 text-sm">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <TeacherShell tenantSlug={slug} userEmail={userEmail} hideHeader={true}>
      {/* Success Toast */}
      {saveSuccess && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
            <Check className="w-4 h-4" />
          </div>
          <span className="font-medium">Changes saved successfully!</span>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        {/* Page Header */}
        <div className="mb-2">
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <p className="text-gray-400 mt-1">Manage your account preferences</p>
        </div>

        {/* Profile Section */}
        <div className="bg-gray-800/60 p-6 rounded-2xl shadow-xl border border-gray-700/50 backdrop-blur-sm">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <User className="w-5 h-5 text-blue-400" />
            </div>
            Profile
          </h2>

          {/* Profile Picture */}
          <div className="flex items-center gap-5 mb-6 pb-6 border-b border-gray-700/50">
            <div className="relative">
              {uploadingAvatar ? (
                <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                </div>
              ) : avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="w-20 h-20 rounded-full object-cover ring-4 ring-purple-500/30"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white text-2xl font-bold ring-4 ring-purple-500/30">
                  {fullName?.[0]?.toUpperCase() || userEmail?.[0]?.toUpperCase() || 'T'}
                </div>
              )}
              <label className="absolute -bottom-1 -right-1 w-8 h-8 bg-purple-600 hover:bg-purple-500 rounded-full flex items-center justify-center cursor-pointer shadow-lg transition-all duration-200 hover:scale-110">
                <Camera className="w-4 h-4 text-white" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                  disabled={uploadingAvatar}
                />
              </label>
            </div>
            <div>
              <p className="text-white font-medium">Upload a profile picture</p>
              <p className="text-gray-400 text-sm">JPG, PNG or GIF (Max 2MB)</p>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-5">
            {/* Email */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                <Mail className="w-4 h-4 text-gray-500" />
                Email
              </label>
              <input
                type="email"
                value={userEmail}
                disabled
                className="w-full bg-gray-900/50 text-gray-400 rounded-xl px-4 py-3 border border-gray-700 cursor-not-allowed"
              />
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
              <input
                type="text"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-gray-700/60 text-gray-100 rounded-xl px-4 py-3 border border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 outline-none placeholder:text-gray-500"
              />
            </div>

            {/* Phone Number */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                <Phone className="w-4 h-4 text-gray-500" />
                Phone Number
              </label>
              <input
                type="tel"
                placeholder="e.g. +27 82 123 4567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full bg-gray-700/60 text-gray-100 rounded-xl px-4 py-3 border border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 outline-none placeholder:text-gray-500"
              />
              <p className="text-xs text-gray-500 mt-2">Used for notifications and account recovery</p>
            </div>

            {saveError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
                <X className="w-5 h-5 text-red-400 shrink-0" />
                <p className="text-sm text-red-300">{saveError}</p>
              </div>
            )}

            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-xl text-sm font-semibold text-white transition-all duration-200 flex items-center gap-2 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 hover:scale-[1.02] active:scale-[0.98]"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="bg-gray-800/60 p-6 rounded-2xl shadow-xl border border-gray-700/50 backdrop-blur-sm">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Bell className="w-5 h-5 text-amber-400" />
            </div>
            Notifications
          </h2>

          <div className="space-y-1">
            <div className="flex items-center justify-between py-4 border-b border-gray-700/50">
              <div>
                <p className="text-white font-medium">Email Notifications</p>
                <p className="text-gray-400 text-sm mt-0.5">Receive updates via email</p>
              </div>
              <Toggle enabled={emailNotifications} onChange={() => setEmailNotifications(!emailNotifications)} />
            </div>

            <div className="flex items-center justify-between py-4">
              <div>
                <p className="text-white font-medium">Push Notifications</p>
                <p className="text-gray-400 text-sm mt-0.5">Receive push notifications</p>
              </div>
              <Toggle enabled={pushNotifications} onChange={() => setPushNotifications(!pushNotifications)} />
            </div>
          </div>
        </div>

        {/* Appearance Section */}
        <div className="bg-gray-800/60 p-6 rounded-2xl shadow-xl border border-gray-700/50 backdrop-blur-sm">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Moon className="w-5 h-5 text-purple-400" />
            </div>
            Appearance
          </h2>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-white font-medium">Dark Mode</p>
              <p className="text-gray-400 text-sm mt-0.5">Toggle dark mode theme</p>
            </div>
            <Toggle enabled={darkMode} onChange={() => setDarkMode(!darkMode)} />
          </div>
        </div>

        {/* Language Section */}
        <div className="bg-gray-800/60 p-6 rounded-2xl shadow-xl border border-gray-700/50 backdrop-blur-sm">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Globe className="w-5 h-5 text-green-400" />
            </div>
            Language
          </h2>

          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full bg-gray-700/60 text-gray-100 rounded-xl px-4 py-3 border border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 outline-none cursor-pointer appearance-none"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.5em 1.5em' }}
          >
            <option value="en-ZA">English (South Africa)</option>
            <option value="af-ZA">Afrikaans</option>
            <option value="zu-ZA">Zulu</option>
            <option value="xh-ZA">Xhosa</option>
            <option value="st-ZA">Sesotho</option>
            <option value="tn-ZA">Setswana</option>
          </select>
        </div>

        {/* Security Section */}
        <div className="bg-gray-800/60 p-6 rounded-2xl shadow-xl border border-gray-700/50 backdrop-blur-sm">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <Lock className="w-5 h-5 text-cyan-400" />
            </div>
            Security
          </h2>

          <button
            onClick={() => setShowPasswordModal(true)}
            className="w-full px-4 py-4 bg-gray-700/50 hover:bg-gray-700 border border-gray-600 hover:border-gray-500 rounded-xl text-white font-medium transition-all duration-200 flex items-center justify-between group"
          >
            <span>Change Password</span>
            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-white group-hover:translate-x-1 transition-all" />
          </button>
        </div>

        {/* Sign Out Section */}
        <div className="bg-gray-800/60 p-6 rounded-2xl shadow-xl border border-red-500/20 backdrop-blur-sm">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
              <LogOut className="w-5 h-5 text-red-400" />
            </div>
            Sign Out
          </h2>

          <p className="text-gray-400 text-sm mb-5">Sign out from your account on this device.</p>

          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full px-4 py-3.5 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-xl text-white font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 hover:shadow-red-500/30 hover:scale-[1.01] active:scale-[0.99]"
          >
            <LogOut className="w-5 h-5" />
            {signingOut ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-700 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-cyan-400" />
                </div>
                Change Password
              </h3>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordError(null);
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="w-9 h-9 rounded-xl bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">New Password</label>
                <input
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-gray-700/60 text-gray-100 rounded-xl px-4 py-3 border border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 outline-none placeholder:text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-gray-700/60 text-gray-100 rounded-xl px-4 py-3 border border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 outline-none placeholder:text-gray-500"
                />
              </div>

              {passwordError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
                  <X className="w-5 h-5 text-red-400 shrink-0" />
                  <p className="text-sm text-red-300">{passwordError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordError(null);
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-xl text-white font-medium transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePasswordChange}
                  disabled={changingPassword || !newPassword || !confirmPassword}
                  className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-xl text-white font-semibold transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {changingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
                  {changingPassword ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </TeacherShell>
  );
}
