'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import DailyIframe, { DailyCall, DailyParticipant, DailyEventObjectParticipant } from '@daily-co/daily-js';

interface GroupCallContextType {
  // State
  callObject: DailyCall | null;
  isInCall: boolean;
  isJoining: boolean;
  participants: Map<string, DailyParticipant>;
  localParticipant: DailyParticipant | null;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isRecording: boolean;
  error: string | null;
  
  // Actions
  createRoom: (options: CreateRoomOptions) => Promise<RoomInfo | null>;
  joinRoom: (roomUrl: string, userName?: string) => Promise<boolean>;
  leaveRoom: () => Promise<void>;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  muteParticipant: (participantId: string) => void;
  removeParticipant: (participantId: string) => void;
  muteAll: () => void;
}

interface CreateRoomOptions {
  name: string;
  classId?: string;
  preschoolId: string;
  maxParticipants?: number;
  enableRecording?: boolean;
  expiryMinutes?: number;
}

interface RoomInfo {
  id: string;
  name: string;
  url: string;
  expiresAt: string;
}

const GroupCallContext = createContext<GroupCallContextType | null>(null);

export function useGroupCall() {
  const context = useContext(GroupCallContext);
  if (!context) {
    throw new Error('useGroupCall must be used within a GroupCallProvider');
  }
  return context;
}

interface GroupCallProviderProps {
  children: ReactNode;
}

export function GroupCallProvider({ children }: GroupCallProviderProps) {
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const [isInCall, setIsInCall] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [participants, setParticipants] = useState<Map<string, DailyParticipant>>(new Map());
  const [localParticipant, setLocalParticipant] = useState<DailyParticipant | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle participant updates
  const handleParticipantJoined = useCallback((event: DailyEventObjectParticipant | undefined) => {
    if (!event?.participant) return;
    setParticipants(prev => {
      const updated = new Map(prev);
      updated.set(event.participant.session_id, event.participant);
      return updated;
    });
  }, []);

  const handleParticipantUpdated = useCallback((event: DailyEventObjectParticipant | undefined) => {
    if (!event?.participant) return;
    setParticipants(prev => {
      const updated = new Map(prev);
      updated.set(event.participant.session_id, event.participant);
      return updated;
    });
    
    // Update local participant state if it's us
    if (event.participant.local) {
      setLocalParticipant(event.participant);
      setIsMuted(!event.participant.audio);
      setIsVideoOff(!event.participant.video);
      setIsScreenSharing(event.participant.screen || false);
    }
  }, []);

  const handleParticipantLeft = useCallback((event: { participant: DailyParticipant } | undefined) => {
    if (!event?.participant) return;
    setParticipants(prev => {
      const updated = new Map(prev);
      updated.delete(event.participant.session_id);
      return updated;
    });
  }, []);

  // Create a room via our API
  const createRoom = useCallback(async (options: CreateRoomOptions): Promise<RoomInfo | null> => {
    try {
      setError(null);
      const response = await fetch('/api/daily/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include cookies for auth
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create room');
      }

      const data = await response.json();
      return data.room;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create room';
      setError(message);
      console.error('Error creating room:', err);
      return null;
    }
  }, []);

  // Join a room
  const joinRoom = useCallback(async (roomUrl: string, userName?: string): Promise<boolean> => {
    try {
      setError(null);
      setIsJoining(true);

      // Clean up any existing call object first to prevent duplicate instances
      if (callObject) {
        try {
          await callObject.leave();
          await callObject.destroy();
        } catch (e) {
          console.warn('Error cleaning up previous call object:', e);
        }
        setCallObject(null);
      }

      // Get room name from URL
      const roomName = roomUrl.split('/').pop() || '';

      // Get meeting token from our API
      const tokenResponse = await fetch('/api/daily/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include cookies for auth
        body: JSON.stringify({ roomName, userName }),
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to get meeting token');
      }

      const { token } = await tokenResponse.json();

      // Create Daily call object with allowMultipleCallInstances as fallback
      const newCallObject = DailyIframe.createCallObject({
        audioSource: true,
        videoSource: true,
        allowMultipleCallInstances: true, // Allow as fallback for edge cases
      });

      // Set up event listeners
      newCallObject
        .on('joined-meeting', () => {
          setIsInCall(true);
          setIsJoining(false);
          // Get initial participants
          const allParticipants = newCallObject.participants();
          const participantsMap = new Map<string, DailyParticipant>();
          Object.values(allParticipants).forEach((p: DailyParticipant) => {
            participantsMap.set(p.session_id, p);
            if (p.local) {
              setLocalParticipant(p);
              setIsMuted(!p.audio);
              setIsVideoOff(!p.video);
            }
          });
          setParticipants(participantsMap);
        })
        .on('left-meeting', () => {
          setIsInCall(false);
          setParticipants(new Map());
          setLocalParticipant(null);
        })
        .on('participant-joined', handleParticipantJoined)
        .on('participant-updated', handleParticipantUpdated)
        .on('participant-left', handleParticipantLeft)
        .on('recording-started', () => setIsRecording(true))
        .on('recording-stopped', () => setIsRecording(false))
        .on('error', (e) => {
          console.error('Daily error:', e);
          setError(e?.errorMsg || 'Call error occurred');
        });

      setCallObject(newCallObject);

      // Join the room
      await newCallObject.join({
        url: roomUrl,
        token,
      });

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to join room';
      setError(message);
      console.error('Error joining room:', err);
      setIsJoining(false);
      return false;
    }
  }, [callObject, handleParticipantJoined, handleParticipantUpdated, handleParticipantLeft]);

  // Leave the room
  const leaveRoom = useCallback(async () => {
    if (callObject) {
      await callObject.leave();
      await callObject.destroy();
      setCallObject(null);
      setIsInCall(false);
      setParticipants(new Map());
      setLocalParticipant(null);
      setIsMuted(false);
      setIsVideoOff(false);
      setIsScreenSharing(false);
      setIsRecording(false);
    }
  }, [callObject]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (callObject) {
      const newMutedState = !isMuted;
      callObject.setLocalAudio(!newMutedState);
      setIsMuted(newMutedState);
    }
  }, [callObject, isMuted]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (callObject) {
      const newVideoOffState = !isVideoOff;
      callObject.setLocalVideo(!newVideoOffState);
      setIsVideoOff(newVideoOffState);
    }
  }, [callObject, isVideoOff]);

  // Toggle screen share
  const toggleScreenShare = useCallback(async () => {
    if (!callObject) return;
    
    try {
      if (isScreenSharing) {
        await callObject.stopScreenShare();
      } else {
        await callObject.startScreenShare();
      }
      setIsScreenSharing(!isScreenSharing);
    } catch (err) {
      console.error('Error toggling screen share:', err);
    }
  }, [callObject, isScreenSharing]);

  // Start recording (owner only)
  const startRecording = useCallback(async () => {
    if (callObject) {
      try {
        await callObject.startRecording();
      } catch (err) {
        console.error('Error starting recording:', err);
        setError('Failed to start recording');
      }
    }
  }, [callObject]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    if (callObject) {
      try {
        await callObject.stopRecording();
      } catch (err) {
        console.error('Error stopping recording:', err);
      }
    }
  }, [callObject]);

  // Mute a specific participant (owner only)
  const muteParticipant = useCallback((participantId: string) => {
    if (callObject) {
      callObject.updateParticipant(participantId, { setAudio: false });
    }
  }, [callObject]);

  // Remove a participant (owner only)
  const removeParticipant = useCallback((participantId: string) => {
    if (callObject) {
      callObject.updateParticipant(participantId, { eject: true });
    }
  }, [callObject]);

  // Mute all participants except local
  const muteAll = useCallback(() => {
    if (callObject) {
      participants.forEach((participant) => {
        if (!participant.local) {
          callObject.updateParticipant(participant.session_id, { setAudio: false });
        }
      });
    }
  }, [callObject, participants]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callObject) {
        callObject.leave();
        callObject.destroy();
      }
    };
  }, [callObject]);

  const value: GroupCallContextType = {
    callObject,
    isInCall,
    isJoining,
    participants,
    localParticipant,
    isMuted,
    isVideoOff,
    isScreenSharing,
    isRecording,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    startRecording,
    stopRecording,
    muteParticipant,
    removeParticipant,
    muteAll,
  };

  return (
    <GroupCallContext.Provider value={value}>
      {children}
    </GroupCallContext.Provider>
  );
}
