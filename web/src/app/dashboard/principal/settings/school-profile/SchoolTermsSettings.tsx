'use client';

import { useState, useEffect } from 'react';
import { FileText, ExternalLink, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface SchoolTermsSettingsProps {
  organizationId: string;
  initialTermsUrl?: string;
}

export function SchoolTermsSettings({ organizationId, initialTermsUrl }: SchoolTermsSettingsProps) {
  const supabase = createClient();
  const [termsUrl, setTermsUrl] = useState(initialTermsUrl || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setTermsUrl(initialTermsUrl || '');
  }, [initialTermsUrl]);

  const handleChange = (value: string) => {
    setTermsUrl(value);
    setIsDirty(value !== (initialTermsUrl || ''));
    setMessage(null);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      // Validate URL if provided
      if (termsUrl && !isValidUrl(termsUrl)) {
        setMessage({ type: 'error', text: 'Please enter a valid URL (must start with http:// or https://)' });
        return;
      }

      const { error } = await supabase
        .from('organizations')
        .update({ 
          terms_and_conditions_url: termsUrl || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', organizationId);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Terms & Conditions URL updated successfully!' });
      setIsDirty(false);

      // Clear success message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving terms URL:', error);
      setMessage({ type: 'error', text: 'Failed to update terms URL. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const isValidUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleTestUrl = () => {
    if (termsUrl && isValidUrl(termsUrl)) {
      window.open(termsUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
          <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Terms & Conditions
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Set the URL for your school's terms and conditions. This will be shown to parents during registration.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* URL Input */}
        <div>
          <label htmlFor="termsUrl" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Terms & Conditions URL
          </label>
          <div className="flex gap-2">
            <input
              id="termsUrl"
              type="url"
              value={termsUrl}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="https://yourschool.com/terms-and-conditions"
              className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg 
                       bg-white dark:bg-slate-700 text-slate-900 dark:text-white
                       placeholder-slate-400 dark:placeholder-slate-500
                       focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
                       disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={saving}
            />
            {termsUrl && isValidUrl(termsUrl) && (
              <button
                onClick={handleTestUrl}
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                         hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors
                         flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300"
                title="Open in new tab"
              >
                <ExternalLink className="w-4 h-4" />
                Test
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Parents will see this link on the registration form and in the mobile app
          </p>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
            💡 How to set up your terms page:
          </h4>
          <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1 ml-4 list-disc">
            <li>Host your terms as an HTML page or PDF on your website</li>
            <li>Use a service like Google Docs (publish to web) or Notion (share public link)</li>
            <li>Contact EduSitePro support to create a custom terms page for your school</li>
            <li>Leave blank if you don't have terms & conditions yet</li>
          </ul>
        </div>

        {/* Status Message */}
        {message && (
          <div className={`flex items-start gap-2 p-3 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            )}
            <p className={`text-sm ${
              message.type === 'success' 
                ? 'text-green-800 dark:text-green-300' 
                : 'text-red-800 dark:text-red-300'
            }`}>
              {message.text}
            </p>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 dark:disabled:bg-slate-700
                     text-white font-medium rounded-lg transition-colors
                     disabled:cursor-not-allowed disabled:opacity-50
                     flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
