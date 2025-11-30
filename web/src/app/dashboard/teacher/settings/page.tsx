'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { User, Bell, Lock, Globe, Moon, LogOut, Camera, Phone, Mail, Check, X, Loader2, ChevronRight } from 'lucide-react';

// Simple Toggle Component
function Toggle({ defaultOn = false, onChange }: { defaultOn?: boolean; onChange?: (checked: boolean) => void }) {
  const [checked, setChecked] = useState(defaultOn);
  
  const handleToggle = () => {
    const newValue = !checked;
    setChecked(newValue);
    onChange?.(newValue);
  };
  
  return (
    <button
      onClick={handleToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-blue-600' : 'bg-gray-700'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

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

if (loading || profileLoading) {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
    </div>
  );
}

return (
  <TeacherShell tenantSlug={slug} userEmail={userEmail} userId={userId}>
      {/* Success Toast */}
      {saveSuccess && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2">
          <Check size={18} />
          <span className="font-medium">Saved!</span>
        </div>
      )}

      <div className="w-full min-h-screen overflow-y-auto px-4 pb-24 bg-gray-950 text-white">

        {/* Page Title */}
        <h1 className="text-3xl font-bold mb-6 pt-4">Settings</h1>


        {/* -------------------- PROFILE -------------------- */}
        <section className="bg-gray-900/60 rounded-xl p-4 mb-6 border border-gray-800">

          <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
            <User size={20} /> Profile
          </h2>

          {/* Avatar Upload */}
          <div className="flex items-center gap-4 mb-4">
            {uploadingAvatar ? (
              <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center">
                <Loader2 size={24} className="animate-spin text-blue-400" />
              </div>
            ) : avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
                {fullName?.[0]?.toUpperCase() || userEmail?.[0]?.toUpperCase() || 'T'}
              </div>
            )}

            <label className="text-sm bg-blue-600 px-3 py-1.5 rounded-lg shadow cursor-pointer hover:bg-blue-500 transition">
              Upload Picture
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Email */}
          <label className="block mb-3">
            <span className="text-sm opacity-70 flex items-center gap-2">
              <Mail size={16} /> Email
            </span>
            <input
              type="email"
              value={userEmail || ''}
              disabled
              className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg p-2 opacity-60 cursor-not-allowed"
            />
          </label>

          {/* Full Name */}
          <label className="block mb-3">
            <span className="text-sm opacity-70">Full Name</span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg p-2 focus:border-blue-500 focus:outline-none"
              placeholder="Enter full name"
            />
          </label>

          {/* Phone */}
          <label className="block mb-4">
            <span className="text-sm opacity-70 flex items-center gap-2">
              <Phone size={16} /> Phone Number
            </span>
            <input
              type="text"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg p-2 focus:border-blue-500 focus:outline-none"
              placeholder="+27..."
            />
          </label>

          {saveError && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm flex items-center gap-2">
              <X size={16} />
              {saveError}
            </div>
          )}

          <button 
            onClick={handleSaveProfile}
            disabled={saving}
            className="w-full bg-blue-600 py-2.5 rounded-lg font-medium shadow hover:bg-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={18} className="animate-spin" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </section>



        {/* -------------------- NOTIFICATIONS -------------------- */}
        <section className="bg-gray-900/60 rounded-xl p-4 mb-6 border border-gray-800">
          <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
            <Bell size={20} /> Notifications
          </h2>

          <div className="flex items-center justify-between py-2">
            <span>Email Notifications</span>
            <Toggle defaultOn={emailNotifications} onChange={setEmailNotifications} />
          </div>

          <div className="flex items-center justify-between py-2">
            <span>Push Notifications</span>
            <Toggle defaultOn={pushNotifications} onChange={setPushNotifications} />
          </div>
        </section>



        {/* -------------------- APPEARANCE -------------------- */}
        <section className="bg-gray-900/60 rounded-xl p-4 mb-6 border border-gray-800">
          <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
            <Moon size={20} /> Appearance
          </h2>

          <div className="flex items-center justify-between py-2">
            <span>Dark Mode</span>
            <Toggle defaultOn={darkMode} onChange={setDarkMode} />
          </div>
        </section>



        {/* -------------------- LANGUAGE -------------------- */}
        <section className="bg-gray-900/60 rounded-xl p-4 mb-6 border border-gray-800">
          <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
            <Globe size={20} /> Language
          </h2>

          <select 
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full bg-gray-800 p-2.5 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="en-ZA">English (South Africa)</option>
            <option value="xitsonga">Xitsonga</option>
            <option value="sepedi">Sepedi</option>
            <option value="zulu">Zulu</option>
            <option value="afrikaans">Afrikaans</option>
          </select>
        </section>



        {/* -------------------- SECURITY -------------------- */}
        <section className="bg-gray-900/60 rounded-xl p-4 mb-6 border border-gray-800">
          <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
            <Lock size={20} /> Security
          </h2>

          <button 
            onClick={() => setShowPasswordModal(true)}
            className="w-full bg-gray-800 py-2.5 rounded-lg font-medium hover:bg-gray-700 transition flex items-center justify-center gap-2"
          >
            <ChevronRight size={18} />
            Change Password
          </button>
        </section>



        {/* -------------------- SIGN OUT -------------------- */}
        <section className="bg-red-900/40 rounded-xl p-4 border border-red-800">
          <button 
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full flex items-center justify-center gap-2 text-red-400 font-semibold py-2 hover:text-red-300 transition disabled:opacity-50"
          >
            {signingOut ? <Loader2 size={20} className="animate-spin" /> : <LogOut size={20} />}
            {signingOut ? 'Signing out...' : 'Sign Out'}
          </button>
        </section>

      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl p-5 w-full max-w-md border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <Lock size={20} /> Change Password
              </h3>
              <button 
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordError(null);
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="p-1 hover:bg-gray-800 rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="text-sm opacity-70">New Password</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg p-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="Enter new password"
                />
              </label>

              <label className="block">
                <span className="text-sm opacity-70">Confirm Password</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg p-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="Confirm new password"
                />
              </label>

              {passwordError && (
                <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm flex items-center gap-2">
                  <X size={16} />
                  {passwordError}
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
                  className="flex-1 bg-gray-800 py-2.5 rounded-lg font-medium hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePasswordChange}
                  disabled={changingPassword || !newPassword || !confirmPassword}
                  className="flex-1 bg-blue-600 py-2.5 rounded-lg font-medium hover:bg-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {changingPassword && <Loader2 size={18} className="animate-spin" />}
                  {changingPassword ? 'Changing...' : 'Change'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </TeacherShell>
  );
}
