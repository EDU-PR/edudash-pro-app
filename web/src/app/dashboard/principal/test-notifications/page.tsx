'use client';

import { useState } from 'react';
import { PrincipalShell } from '@/components/dashboard/principal/PrincipalShell';
import { Bell, Send, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function TestNotificationsPage() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [notificationType, setNotificationType] = useState<'message' | 'announcement' | 'call'>('message');
  const [customTitle, setCustomTitle] = useState('');
  const [customBody, setCustomBody] = useState('');

  // Check if notifications are supported and get permission
  const requestPermission = async () => {
    if (!('Notification' in window)) {
      setResult({ success: false, message: 'Notifications not supported in this browser' });
      return;
    }

    if (!('serviceWorker' in navigator)) {
      setResult({ success: false, message: 'Service Workers not supported' });
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setResult({ success: false, message: 'Notification permission denied' });
        return;
      }

      // Get the service worker registration
      const registration = await navigator.serviceWorker.ready;
      
      // IMPORTANT: Unsubscribe from any existing subscription first
      // This fixes "Registration failed - A subscription with a different applicationServerKey already exists"
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        console.log('[Test Notifications] Unsubscribing from old subscription...');
        await existingSubscription.unsubscribe();
        console.log('[Test Notifications] Old subscription removed');
      }
      
      // Subscribe to push notifications with current VAPID key
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 
        'BLXiYIECWZGIlbDkQKKPhl3t86tGQRQDAHnNq5JHMg9btdbjiVgt3rLDeGhz5LveRarHS-9vY84aFkQrfApmNpE';
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      setSubscription(subscription);
      setIsSubscribed(true);
      setResult({ success: true, message: 'Successfully subscribed to push notifications!' });
      
      // Save subscription to database
      await saveSubscription(subscription);
    } catch (error) {
      console.error('Error subscribing to notifications:', error);
      setResult({ success: false, message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  };

  // Helper function to convert VAPID key
  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  // Save subscription to database
  const saveSubscription = async (subscription: PushSubscription) => {
    const subJSON = subscription.toJSON();
    
    try {
      console.log('[Test Notifications] Saving subscription:', {
        endpoint: subscription.endpoint,
        hasKeys: !!subJSON.keys,
        p256dh: subJSON.keys?.p256dh?.substring(0, 20) + '...',
        auth: subJSON.keys?.auth?.substring(0, 20) + '...'
      });

      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subJSON.keys?.p256dh || '',
              auth: subJSON.keys?.auth || ''
            }
          },
          topics: ['test', 'updates'], // Include 'updates' to allow anonymous subscription
          // userId will be extracted from session by the API
        })
      });

      const data = await response.json();
      console.log('[Test Notifications] Subscription response:', data);

      if (!response.ok) {
        console.error('Failed to save subscription to database:', data);
        throw new Error(data.error || 'Failed to save subscription');
      }
    } catch (error) {
      console.error('Error saving subscription:', error);
      throw error;
    }
  };

  // Send test notification
  const sendTestNotification = async () => {
    setSending(true);
    setResult(null);

    try {
      const title = customTitle || getDefaultTitle(notificationType);
      const bodyText = customBody || getDefaultBody(notificationType);

      console.log('[Test Notifications] Sending notification:', {
        topic: 'test',
        type: notificationType,
        title,
        body: bodyText
      });

      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: 'test', // Send to all subscriptions with 'test' topic
          type: notificationType,
          title,
          body: bodyText, // Use 'body' as the API expects
          icon: '/icon-192.png',
          url: '/dashboard/principal',
          requireInteraction: notificationType === 'call',
          data: {
            url: '/dashboard/principal',
            type: notificationType,
            timestamp: Date.now()
          }
        })
      });

      const data = await response.json();
      console.log('[Test Notifications] Send response:', data);

      if (response.ok) {
        setResult({ 
          success: true, 
          message: `Test ${notificationType} notification sent! (${data.sent || 0} devices)` 
        });
      } else {
        setResult({ success: false, message: `Failed: ${data.error || 'Unknown error'}` });
      }
    } catch (error) {
      console.error('[Test Notifications] Send error:', error);
      setResult({ success: false, message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setSending(false);
    }
  };

  const getDefaultTitle = (type: string) => {
    switch (type) {
      case 'message':
        return '💬 New Message';
      case 'announcement':
        return '📢 Important Announcement';
      case 'call':
        return '📹 Incoming Call';
      default:
        return 'Test Notification';
    }
  };

  const getDefaultBody = (type: string) => {
    switch (type) {
      case 'message':
        return 'You have a new message from a parent';
      case 'announcement':
        return 'A new school announcement has been posted';
      case 'call':
        return 'John Doe is calling you';
      default:
        return 'This is a test notification';
    }
  };

  return (
    <PrincipalShell>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Test Push Notifications</h1>
          <p className="text-gray-400">
            Test the push notification system for your school
          </p>
        </div>

        {/* Permission Status */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notification Permission
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300">Status:</p>
                <p className={`font-semibold ${isSubscribed ? 'text-green-400' : 'text-yellow-400'}`}>
                  {isSubscribed ? '✓ Subscribed' : '⚠ Not subscribed'}
                </p>
              </div>
              
              <button
                onClick={requestPermission}
                disabled={isSubscribed}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  isSubscribed
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {isSubscribed ? 'Already Subscribed' : 'Enable Notifications'}
              </button>
            </div>

            {subscription && (
              <div className="mt-4 p-4 bg-gray-900 rounded border border-gray-700">
                <p className="text-xs text-gray-400 mb-2">Subscription Details:</p>
                <pre className="text-xs text-gray-300 overflow-x-auto">
                  {JSON.stringify(subscription.toJSON(), null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Test Notification Form */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Send className="w-5 h-5" />
            Send Test Notification
          </h2>

          <div className="space-y-4">
            {/* Notification Type */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Notification Type
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(['message', 'announcement', 'call'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setNotificationType(type)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      notificationType === type
                        ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                        : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-2xl mb-1">
                        {type === 'message' && '💬'}
                        {type === 'announcement' && '📢'}
                        {type === 'call' && '📹'}
                      </div>
                      <div className="text-xs font-semibold capitalize">{type}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Title */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Title (optional)
              </label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder={getDefaultTitle(notificationType)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Custom Body */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Message (optional)
              </label>
              <textarea
                value={customBody}
                onChange={(e) => setCustomBody(e.target.value)}
                placeholder={getDefaultBody(notificationType)}
                rows={3}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            {/* Send Button */}
            <button
              onClick={sendTestNotification}
              disabled={!isSubscribed || sending}
              className={`w-full px-4 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                !isSubscribed || sending
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {sending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Send Test Notification
                </>
              )}
            </button>

            {/* Result */}
            {result && (
              <div
                className={`p-4 rounded-lg border-2 flex items-start gap-3 ${
                  result.success
                    ? 'bg-green-500/10 border-green-500 text-green-400'
                    : 'bg-red-500/10 border-red-500 text-red-400'
                }`}
              >
                {result.success ? (
                  <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold">{result.success ? 'Success!' : 'Error'}</p>
                  <p className="text-sm mt-1">{result.message}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <h3 className="text-blue-400 font-semibold mb-2">ℹ️ Testing Tips</h3>
          <ul className="text-sm text-blue-300 space-y-1 list-disc list-inside">
            <li>Service workers only work in production or on localhost</li>
            <li>You must grant notification permission first</li>
            <li>Check browser console for detailed logs</li>
            <li>Call notifications require user interaction (requireInteraction: true)</li>
            <li>Verify VAPID keys are set in environment variables</li>
          </ul>
        </div>
      </div>
    </PrincipalShell>
  );
}
