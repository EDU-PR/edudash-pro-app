'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  Volume2,
  VolumeX,
  Minimize2,
  Maximize2,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';

type CallState = 'idle' | 'connecting' | 'connected' | 'ended' | 'failed';

interface SimpleCallInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  roomName?: string;
  userName?: string;
  isOwner?: boolean;
}

export const SimpleCallInterface = ({
  isOpen,
  onClose,
  roomName,
  userName,
  isOwner = false,
}: SimpleCallInterfaceProps) => {
  const [callState, setCallState] = useState<CallState>('idle');
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState(0);

  const callFrameRef = useRef<HTMLDivElement>(null);
  const dailyCallRef = useRef<DailyCall | null>(null);
  const supabase = createClient();

  // Initialize call when opened
  useEffect(() => {
    if (!isOpen || !roomName) return;

    const initializeCall = async () => {
      try {
        setCallState('connecting');
        setError(null);

        // Get meeting token from API
        const response = await fetch('/api/daily/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName,
            userName,
            isOwner,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to get meeting token');
        }

        const { token } = await response.json();

        // Create Daily call object
        if (!callFrameRef.current) {
          throw new Error('Call frame ref not ready');
        }

        const daily = DailyIframe.createFrame(callFrameRef.current, {
          showLeaveButton: false,
          showFullscreenButton: true,
          iframeStyle: {
            width: '100%',
            height: '100%',
            border: 'none',
            borderRadius: '12px',
          },
        });

        dailyCallRef.current = daily;

        // Set up event listeners
        daily
          .on('joined-meeting', () => {
            console.log('[SimpleCall] Joined meeting');
            setCallState('connected');
          })
          .on('left-meeting', () => {
            console.log('[SimpleCall] Left meeting');
            handleEndCall();
          })
          .on('participant-joined', () => {
            const participants = daily.participants();
            setParticipantCount(Object.keys(participants).length);
          })
          .on('participant-left', () => {
            const participants = daily.participants();
            setParticipantCount(Object.keys(participants).length);
          })
          .on('error', (error) => {
            console.error('[SimpleCall] Daily error:', error);
            setError(error?.errorMsg || 'Call error occurred');
            setCallState('failed');
          });

        // Join the meeting
        await daily.join({
          url: `https://edudashpro.daily.co/${roomName}`,
          token,
        });

      } catch (err) {
        console.error('[SimpleCall] Initialization error:', err);
        setError(err instanceof Error ? err.message : 'Failed to start call');
        setCallState('failed');
      }
    };

    initializeCall();

    // Cleanup on unmount
    return () => {
      if (dailyCallRef.current) {
        dailyCallRef.current.destroy();
        dailyCallRef.current = null;
      }
    };
  }, [isOpen, roomName, userName, isOwner]);

  // Toggle video
  const toggleVideo = useCallback(async () => {
    if (!dailyCallRef.current) return;
    
    try {
      await dailyCallRef.current.setLocalVideo(!isVideoEnabled);
      setIsVideoEnabled(!isVideoEnabled);
    } catch (err) {
      console.error('[SimpleCall] Toggle video error:', err);
    }
  }, [isVideoEnabled]);

  // Toggle audio
  const toggleAudio = useCallback(async () => {
    if (!dailyCallRef.current) return;
    
    try {
      await dailyCallRef.current.setLocalAudio(!isAudioEnabled);
      setIsAudioEnabled(!isAudioEnabled);
    } catch (err) {
      console.error('[SimpleCall] Toggle audio error:', err);
    }
  }, [isAudioEnabled]);

  // Toggle screen sharing
  const toggleScreenShare = useCallback(async () => {
    if (!dailyCallRef.current) return;
    
    try {
      if (isScreenSharing) {
        await dailyCallRef.current.stopScreenShare();
      } else {
        await dailyCallRef.current.startScreenShare();
      }
      setIsScreenSharing(!isScreenSharing);
    } catch (err) {
      console.error('[SimpleCall] Toggle screen share error:', err);
    }
  }, [isScreenSharing]);

  // End call
  const handleEndCall = useCallback(() => {
    if (dailyCallRef.current) {
      dailyCallRef.current.leave();
      dailyCallRef.current.destroy();
      dailyCallRef.current = null;
    }
    setCallState('ended');
    onClose();
  }, [onClose]);

  // Don't render if not open
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className={`bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${
          isMinimized ? 'w-80 h-64' : 'w-full h-full max-w-7xl max-h-[90vh]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                callState === 'connected' ? 'bg-green-500 animate-pulse' : 
                callState === 'connecting' ? 'bg-yellow-500 animate-pulse' : 
                'bg-red-500'
              }`} />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {callState === 'connected' ? 'Connected' :
                 callState === 'connecting' ? 'Connecting...' :
                 callState === 'failed' ? 'Call Failed' :
                 'Call Ended'}
              </span>
            </div>
            {participantCount > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {participantCount} participant{participantCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title={isMinimized ? 'Maximize' : 'Minimize'}
            >
              {isMinimized ? (
                <Maximize2 className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              ) : (
                <Minimize2 className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              )}
            </button>
            <button
              onClick={handleEndCall}
              className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
              title="Close"
            >
              <X className="w-5 h-5 text-red-600 dark:text-red-400" />
            </button>
          </div>
        </div>

        {/* Call Frame or Error */}
        <div className="relative w-full h-[calc(100%-140px)] bg-gray-900">
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-4 p-6 max-w-md">
                <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
                <h3 className="text-xl font-semibold text-white">Call Failed</h3>
                <p className="text-gray-300">{error}</p>
                <button
                  onClick={handleEndCall}
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          ) : callState === 'connecting' ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-4">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto" />
                <p className="text-white text-lg">Connecting to call...</p>
              </div>
            </div>
          ) : (
            <div ref={callFrameRef} className="w-full h-full" />
          )}
        </div>

        {/* Controls */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-center gap-3">
            {/* Microphone */}
            <button
              onClick={toggleAudio}
              disabled={callState !== 'connected'}
              className={`p-4 rounded-full transition-all ${
                isAudioEnabled
                  ? 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                  : 'bg-red-500 hover:bg-red-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={isAudioEnabled ? 'Mute' : 'Unmute'}
            >
              {isAudioEnabled ? (
                <Mic className="w-6 h-6 text-gray-700 dark:text-gray-200" />
              ) : (
                <MicOff className="w-6 h-6 text-white" />
              )}
            </button>

            {/* Video */}
            <button
              onClick={toggleVideo}
              disabled={callState !== 'connected'}
              className={`p-4 rounded-full transition-all ${
                isVideoEnabled
                  ? 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                  : 'bg-red-500 hover:bg-red-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={isVideoEnabled ? 'Stop Video' : 'Start Video'}
            >
              {isVideoEnabled ? (
                <Video className="w-6 h-6 text-gray-700 dark:text-gray-200" />
              ) : (
                <VideoOff className="w-6 h-6 text-white" />
              )}
            </button>

            {/* Screen Share (Owner only) */}
            {isOwner && (
              <button
                onClick={toggleScreenShare}
                disabled={callState !== 'connected'}
                className={`p-4 rounded-full transition-all ${
                  isScreenSharing
                    ? 'bg-blue-500 hover:bg-blue-600'
                    : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
              >
                {isScreenSharing ? (
                  <MonitorOff className="w-6 h-6 text-white" />
                ) : (
                  <Monitor className="w-6 h-6 text-gray-700 dark:text-gray-200" />
                )}
              </button>
            )}

            {/* End Call */}
            <button
              onClick={handleEndCall}
              className="p-4 rounded-full bg-red-500 hover:bg-red-600 transition-all"
              title="End Call"
            >
              <PhoneOff className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Hook for using the call interface
export const useSimpleCallInterface = () => {
  const [isCallOpen, setIsCallOpen] = useState(false);
  const [callConfig, setCallConfig] = useState<{
    roomName?: string;
    userName?: string;
    isOwner?: boolean;
  }>({});

  const startCall = useCallback((config: {
    roomName: string;
    userName?: string;
    isOwner?: boolean;
  }) => {
    setCallConfig(config);
    setIsCallOpen(true);
  }, []);

  const endCall = useCallback(() => {
    setIsCallOpen(false);
    setCallConfig({});
  }, []);

  return {
    isCallOpen,
    callConfig,
    startCall,
    endCall,
  };
};
