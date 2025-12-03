'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';
import RingtoneService from '@/lib/services/ringtoneService';
import {
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
  Users,
  MessageSquare,
} from 'lucide-react';

type CallState = 'idle' | 'connecting' | 'ringing' | 'connected' | 'ended' | 'failed';

interface VideoCallInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  roomName?: string;
  userName?: string;
  isOwner?: boolean;
  calleeId?: string;
  onCallStateChange?: (state: CallState) => void;
}

export const VideoCallInterface = ({
  isOpen,
  onClose,
  roomName,
  userName,
  isOwner = false,
  calleeId,
  onCallStateChange,
}: VideoCallInterfaceProps) => {
  const [callState, setCallState] = useState<CallState>('idle');
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [callDuration, setCallDuration] = useState(0);

  const callFrameRef = useRef<HTMLDivElement>(null);
  const dailyCallRef = useRef<DailyCall | null>(null);
  const ringbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const callIdRef = useRef<string | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const supabase = createClient();

  // Update parent on state changes
  useEffect(() => {
    onCallStateChange?.(callState);
  }, [callState, onCallStateChange]);

  // Call timer
  useEffect(() => {
    if (callState === 'connected' && participantCount > 1) {
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
    }

    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, [callState, participantCount]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Ringback tone for caller
  useEffect(() => {
    if ((callState === 'connecting' || callState === 'ringing') && isOwner) {
      RingtoneService.playRingtone('outgoing', { loop: true })
        .then(audio => {
          ringbackAudioRef.current = audio;
        })
        .catch(err => {
          console.warn('[VideoCall] Could not play ringback:', err);
        });
    } else if (ringbackAudioRef.current) {
      RingtoneService.stopRingtone(ringbackAudioRef.current);
      ringbackAudioRef.current = null;
    }

    return () => {
      if (ringbackAudioRef.current) {
        RingtoneService.stopRingtone(ringbackAudioRef.current);
        ringbackAudioRef.current = null;
      }
    };
  }, [callState, isOwner]);

  // Initialize call
  useEffect(() => {
    if (!isOpen || !roomName) return;

    let isCleanedUp = false;

    const initializeCall = async () => {
      try {
        setCallState('connecting');
        setError(null);
        setCallDuration(0);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('Not authenticated. Please sign in.');
        }
        const userId = user.id;

        // Wait for DOM to be ready
        await new Promise(resolve => setTimeout(resolve, 100));

        if (isCleanedUp) return;

        if (!callFrameRef.current) {
          throw new Error('Video container not ready. Please try again.');
        }

        // Destroy existing instance
        if (dailyCallRef.current) {
          dailyCallRef.current.destroy();
          dailyCallRef.current = null;
        }

        let roomUrl: string;

        if (isOwner) {
          // Create P2P room
          const roomResponse = await fetch('/api/daily/rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: `Video Call - ${userName}`,
              isPrivate: true,
              expiryMinutes: 60,
              maxParticipants: 10,
              isP2P: true,
            }),
          });

          if (!roomResponse.ok) {
            const errorData = await roomResponse.json();
            throw new Error(errorData.error || 'Failed to create call room');
          }

          const { room } = await roomResponse.json();
          roomUrl = room.url;

          // Create call signaling record
          if (calleeId && !callIdRef.current) {
            const callId = crypto.randomUUID();
            callIdRef.current = callId;

            const { data: callerProfile } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('id', userId)
              .single();

            const callerName = callerProfile
              ? `${callerProfile.first_name || ''} ${callerProfile.last_name || ''}`.trim() || 'Someone'
              : 'Someone';

            await supabase.from('active_calls').insert({
              call_id: callId,
              caller_id: userId,
              callee_id: calleeId,
              call_type: 'video',
              status: 'ringing',
              caller_name: callerName,
              meeting_url: roomUrl,
            });

            await supabase.from('call_signals').insert({
              call_id: callId,
              from_user_id: userId,
              to_user_id: calleeId,
              signal_type: 'offer',
              payload: {
                meeting_url: roomUrl,
                call_type: 'video',
                caller_name: callerName,
              },
            });

            // Send push notification
            try {
              await fetch('/api/notifications/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId: calleeId,
                  title: 'Incoming video call',
                  body: `${callerName} is calling...`,
                  tag: `call-${callId}`,
                  type: 'call',
                  requireInteraction: true,
                  data: { callId, callType: 'video', callerId: userId, callerName, roomUrl },
                }),
              });
            } catch (e) {
              console.warn('[VideoCall] Push notification failed:', e);
            }

            setCallState('ringing');
          }
        } else {
          roomUrl = `https://edudashpro.daily.co/${roomName}`;
        }

        const actualRoomName = roomUrl.split('/').pop() || roomName;

        // Get token
        const response = await fetch('/api/daily/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName: actualRoomName,
            userName,
            isOwner,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to get meeting token');
        }

        const { token } = await response.json();

        if (isCleanedUp) return;

        // Create Daily call frame (with video iframe)
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

        // Event listeners
        daily
          .on('joined-meeting', () => {
            setCallState('connected');
            setParticipantCount(Object.keys(daily.participants()).length);
          })
          .on('left-meeting', () => {
            setCallState('ended');
          })
          .on('participant-joined', () => {
            setParticipantCount(Object.keys(daily.participants()).length);
          })
          .on('participant-left', () => {
            setParticipantCount(Object.keys(daily.participants()).length);
          })
          .on('error', (event) => {
            console.error('[VideoCall] Daily error:', event);
            setError(event?.errorMsg || 'Call error occurred');
            setCallState('failed');
          });

        // Join the call
        await daily.join({
          url: roomUrl,
          token,
        });

      } catch (err) {
        console.error('[VideoCall] Initialization error:', err);
        setError(err instanceof Error ? err.message : 'Failed to start call');
        setCallState('failed');
      }
    };

    initializeCall();

    return () => {
      isCleanedUp = true;
      if (dailyCallRef.current) {
        dailyCallRef.current.destroy();
        dailyCallRef.current = null;
      }
    };
  }, [isOpen, roomName, userName, isOwner, calleeId, supabase]);

  // Toggle video
  const toggleVideo = useCallback(async () => {
    if (!dailyCallRef.current) return;
    try {
      await dailyCallRef.current.setLocalVideo(!isVideoEnabled);
      setIsVideoEnabled(!isVideoEnabled);
    } catch (err) {
      console.error('[VideoCall] Toggle video error:', err);
    }
  }, [isVideoEnabled]);

  // Toggle audio
  const toggleAudio = useCallback(async () => {
    if (!dailyCallRef.current) return;
    try {
      await dailyCallRef.current.setLocalAudio(!isAudioEnabled);
      setIsAudioEnabled(!isAudioEnabled);
    } catch (err) {
      console.error('[VideoCall] Toggle audio error:', err);
    }
  }, [isAudioEnabled]);

  // Toggle screen share
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
      console.error('[VideoCall] Toggle screen share error:', err);
    }
  }, [isScreenSharing]);

  // Toggle speaker
  const toggleSpeaker = useCallback(() => {
    setIsSpeakerEnabled(!isSpeakerEnabled);
  }, [isSpeakerEnabled]);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-sm flex items-center justify-center">
      <div
        className={`bg-gray-900 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${
          isMinimized ? 'w-80 h-64' : 'w-full h-full max-w-7xl max-h-[95vh] m-4'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-800/80 border-b border-gray-700">
          <div className="flex items-center gap-3">
            {/* Status indicator */}
            <div className={`w-2.5 h-2.5 rounded-full ${
              callState === 'connected' && participantCount > 1 ? 'bg-green-500 animate-pulse' :
              callState === 'connected' ? 'bg-blue-500 animate-pulse' :
              callState === 'ringing' ? 'bg-yellow-500 animate-pulse' :
              callState === 'connecting' ? 'bg-yellow-500 animate-pulse' :
              'bg-red-500'
            }`} />
            
            {/* Status text and timer */}
            <span className="text-sm font-medium text-white">
              {callState === 'connected' && participantCount > 1 
                ? `Connected • ${formatDuration(callDuration)}`
                : callState === 'connected' ? 'Waiting for others...'
                : callState === 'ringing' ? 'Ringing...'
                : callState === 'connecting' ? 'Connecting...'
                : callState === 'failed' ? 'Call Failed'
                : 'Video Call'}
            </span>

            {/* Participant count */}
            {participantCount > 0 && (
              <div className="flex items-center gap-1 text-gray-400 text-xs">
                <Users className="w-3.5 h-3.5" />
                <span>{participantCount}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              {isMinimized ? (
                <Maximize2 className="w-4 h-4 text-gray-400" />
              ) : (
                <Minimize2 className="w-4 h-4 text-gray-400" />
              )}
            </button>
            <button
              onClick={handleEndCall}
              className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-red-400" />
            </button>
          </div>
        </div>

        {/* Video Frame */}
        <div className="relative w-full h-[calc(100%-120px)] bg-black">
          {/* Always render the container */}
          <div
            ref={callFrameRef}
            className={`w-full h-full ${error || callState === 'connecting' || callState === 'ringing' ? 'opacity-0' : 'opacity-100'}`}
          />

          {/* Loading overlay */}
          {(callState === 'connecting' || callState === 'ringing') && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center space-y-4">
                <div className="relative">
                  <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto" />
                  {callState === 'ringing' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Video className="w-6 h-6 text-blue-400" />
                    </div>
                  )}
                </div>
                <p className="text-white text-lg font-medium">
                  {callState === 'ringing' ? `Calling ${userName || 'User'}...` : 'Connecting...'}
                </p>
                {callState === 'ringing' && (
                  <p className="text-gray-400 text-sm">Waiting for answer</p>
                )}
              </div>
            </div>
          )}

          {/* Error overlay */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center space-y-4 p-6 max-w-md">
                <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
                <h3 className="text-xl font-semibold text-white">Call Failed</h3>
                <p className="text-gray-400">{error}</p>
                <button
                  onClick={handleEndCall}
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="px-4 py-3 bg-gray-800/80 border-t border-gray-700">
          <div className="flex items-center justify-center gap-2">
            {/* Mic */}
            <button
              onClick={toggleAudio}
              disabled={callState !== 'connected'}
              className={`p-3 rounded-full transition-all ${
                isAudioEnabled
                  ? 'bg-gray-700 hover:bg-gray-600'
                  : 'bg-red-500 hover:bg-red-600'
              } disabled:opacity-50`}
              title={isAudioEnabled ? 'Mute' : 'Unmute'}
            >
              {isAudioEnabled ? (
                <Mic className="w-5 h-5 text-white" />
              ) : (
                <MicOff className="w-5 h-5 text-white" />
              )}
            </button>

            {/* Video */}
            <button
              onClick={toggleVideo}
              disabled={callState !== 'connected'}
              className={`p-3 rounded-full transition-all ${
                isVideoEnabled
                  ? 'bg-gray-700 hover:bg-gray-600'
                  : 'bg-red-500 hover:bg-red-600'
              } disabled:opacity-50`}
              title={isVideoEnabled ? 'Stop Video' : 'Start Video'}
            >
              {isVideoEnabled ? (
                <Video className="w-5 h-5 text-white" />
              ) : (
                <VideoOff className="w-5 h-5 text-white" />
              )}
            </button>

            {/* Screen Share */}
            <button
              onClick={toggleScreenShare}
              disabled={callState !== 'connected'}
              className={`p-3 rounded-full transition-all ${
                isScreenSharing
                  ? 'bg-blue-500 hover:bg-blue-600'
                  : 'bg-gray-700 hover:bg-gray-600'
              } disabled:opacity-50`}
              title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
            >
              {isScreenSharing ? (
                <MonitorOff className="w-5 h-5 text-white" />
              ) : (
                <Monitor className="w-5 h-5 text-white" />
              )}
            </button>

            {/* Speaker */}
            <button
              onClick={toggleSpeaker}
              disabled={callState !== 'connected'}
              className={`p-3 rounded-full transition-all ${
                isSpeakerEnabled
                  ? 'bg-gray-700 hover:bg-gray-600'
                  : 'bg-yellow-500 hover:bg-yellow-600'
              } disabled:opacity-50`}
              title={isSpeakerEnabled ? 'Speaker Off' : 'Speaker On'}
            >
              {isSpeakerEnabled ? (
                <Volume2 className="w-5 h-5 text-white" />
              ) : (
                <VolumeX className="w-5 h-5 text-white" />
              )}
            </button>

            {/* End Call */}
            <button
              onClick={handleEndCall}
              className="p-3 rounded-full bg-red-500 hover:bg-red-600 transition-all ml-4"
              title="End Call"
            >
              <PhoneOff className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoCallInterface;
