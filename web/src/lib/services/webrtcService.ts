'use client';

/**
 * WebRTC Service for P2P Voice Calls
 * Uses Supabase Realtime for signaling
 */

import { createClient } from '@/lib/supabase/client';

export interface WebRTCCallState {
  status: 'idle' | 'connecting' | 'ringing' | 'connected' | 'ended' | 'failed';
  isMuted: boolean;
  isSpeakerOn: boolean;
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
  error: string | null;
}

export interface WebRTCCallConfig {
  callId: string;
  isInitiator: boolean;
  remoteUserId: string;
  onStateChange: (state: Partial<WebRTCCallState>) => void;
  onCallEnded: (reason: string) => void;
}

// STUN/TURN servers for NAT traversal
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

export class WebRTCVoiceCall {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private config: WebRTCCallConfig;
  private supabase = createClient();
  private signalChannel: ReturnType<typeof this.supabase.channel> | null = null;
  private iceCandidatesQueue: RTCIceCandidateInit[] = [];
  private hasRemoteDescription = false;

  constructor(config: WebRTCCallConfig) {
    this.config = config;
  }

  /**
   * Initialize the WebRTC call
   */
  async initialize(): Promise<void> {
    try {
      this.config.onStateChange({ status: 'connecting', error: null });

      // Get local audio stream
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      this.config.onStateChange({ localStream: this.localStream });

      // Create peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: ICE_SERVERS,
      });

      // Add local tracks to peer connection
      this.localStream.getTracks().forEach((track) => {
        if (this.peerConnection && this.localStream) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });

      // Set up event handlers
      this.setupPeerConnectionHandlers();

      // Set up signaling channel
      await this.setupSignalingChannel();

      // If initiator, create and send offer
      if (this.config.isInitiator) {
        await this.createAndSendOffer();
      }

      console.log('[WebRTC] Initialized successfully');
    } catch (error) {
      console.error('[WebRTC] Initialization failed:', error);
      this.config.onStateChange({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Failed to initialize call',
      });
      throw error;
    }
  }

  /**
   * Set up peer connection event handlers
   */
  private setupPeerConnectionHandlers(): void {
    if (!this.peerConnection) return;

    // Handle incoming tracks (remote audio)
    this.peerConnection.ontrack = (event) => {
      console.log('[WebRTC] Remote track received');
      this.remoteStream = event.streams[0];
      this.config.onStateChange({
        remoteStream: this.remoteStream,
        status: 'connected',
      });
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] Sending ICE candidate');
        this.sendSignal('ice-candidate', { candidate: event.candidate.toJSON() });
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('[WebRTC] Connection state:', state);

      switch (state) {
        case 'connected':
          this.config.onStateChange({ status: 'connected' });
          break;
        case 'disconnected':
        case 'failed':
          this.config.onCallEnded('Connection lost');
          break;
        case 'closed':
          this.config.onCallEnded('Call ended');
          break;
      }
    };

    // Handle ICE connection state
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state:', this.peerConnection?.iceConnectionState);
    };
  }

  /**
   * Set up Supabase Realtime channel for signaling
   */
  private async setupSignalingChannel(): Promise<void> {
    const channelName = `webrtc-call-${this.config.callId}`;
    console.log('[WebRTC] Setting up signaling channel:', channelName);

    this.signalChannel = this.supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
      },
    });

    interface SignalPayload {
      type: string;
      data: Record<string, unknown>;
      from: string;
    }

    this.signalChannel
      .on('broadcast', { event: 'signal' }, async ({ payload }: { payload: SignalPayload }) => {
        console.log('[WebRTC] Received signal:', payload.type);
        await this.handleSignal(payload);
      })
      .subscribe((status: string) => {
        console.log('[WebRTC] Signaling channel status:', status);
        if (status === 'SUBSCRIBED') {
          this.config.onStateChange({ status: this.config.isInitiator ? 'ringing' : 'connecting' });
        }
      });
  }

  /**
   * Handle incoming signals
   */
  private async handleSignal(payload: { type: string; data: Record<string, unknown>; from: string }): Promise<void> {
    // Ignore our own signals
    if (payload.from === (await this.getCurrentUserId())) {
      return;
    }

    try {
      switch (payload.type) {
        case 'offer':
          await this.handleOffer(payload.data as { sdp: RTCSessionDescriptionInit });
          break;
        case 'answer':
          await this.handleAnswer(payload.data as { sdp: RTCSessionDescriptionInit });
          break;
        case 'ice-candidate':
          await this.handleIceCandidate(payload.data as { candidate: RTCIceCandidateInit });
          break;
        case 'hangup':
          this.config.onCallEnded('Remote user hung up');
          this.cleanup();
          break;
      }
    } catch (error) {
      console.error('[WebRTC] Error handling signal:', error);
    }
  }

  /**
   * Create and send offer (initiator only)
   */
  private async createAndSendOffer(): Promise<void> {
    if (!this.peerConnection) return;

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    this.sendSignal('offer', { sdp: offer });
    console.log('[WebRTC] Offer sent');
  }

  /**
   * Handle incoming offer (receiver only)
   */
  private async handleOffer(data: { sdp: RTCSessionDescriptionInit }): Promise<void> {
    if (!this.peerConnection) return;

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    this.hasRemoteDescription = true;

    // Process queued ICE candidates
    await this.processIceCandidateQueue();

    // Create and send answer
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    this.sendSignal('answer', { sdp: answer });
    console.log('[WebRTC] Answer sent');
  }

  /**
   * Handle incoming answer (initiator only)
   */
  private async handleAnswer(data: { sdp: RTCSessionDescriptionInit }): Promise<void> {
    if (!this.peerConnection) return;

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    this.hasRemoteDescription = true;

    // Process queued ICE candidates
    await this.processIceCandidateQueue();
    console.log('[WebRTC] Answer received and set');
  }

  /**
   * Handle incoming ICE candidate
   */
  private async handleIceCandidate(data: { candidate: RTCIceCandidateInit }): Promise<void> {
    if (!this.peerConnection) return;

    if (this.hasRemoteDescription) {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    } else {
      // Queue the candidate if we don't have remote description yet
      this.iceCandidatesQueue.push(data.candidate);
    }
  }

  /**
   * Process queued ICE candidates
   */
  private async processIceCandidateQueue(): Promise<void> {
    if (!this.peerConnection) return;

    for (const candidate of this.iceCandidatesQueue) {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
    this.iceCandidatesQueue = [];
  }

  /**
   * Send signal through Supabase Realtime
   */
  private async sendSignal(type: string, data: Record<string, unknown>): Promise<void> {
    if (!this.signalChannel) return;

    const userId = await this.getCurrentUserId();
    await this.signalChannel.send({
      type: 'broadcast',
      event: 'signal',
      payload: { type, data, from: userId },
    });
  }

  /**
   * Get current user ID
   */
  private async getCurrentUserId(): Promise<string> {
    const { data } = await this.supabase.auth.getUser();
    return data.user?.id || '';
  }

  /**
   * Toggle mute
   */
  toggleMute(): boolean {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const isMuted = !audioTrack.enabled;
        this.config.onStateChange({ isMuted });
        return isMuted;
      }
    }
    return false;
  }

  /**
   * Check if muted
   */
  isMuted(): boolean {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      return audioTrack ? !audioTrack.enabled : false;
    }
    return false;
  }

  /**
   * End the call
   */
  async endCall(): Promise<void> {
    console.log('[WebRTC] Ending call');

    // Send hangup signal to remote peer
    await this.sendSignal('hangup', {});

    // Update database
    try {
      await this.supabase
        .from('active_calls')
        .update({ status: 'ended' })
        .eq('call_id', this.config.callId);
    } catch (error) {
      console.error('[WebRTC] Failed to update call status:', error);
    }

    this.cleanup();
    this.config.onCallEnded('Call ended');
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    console.log('[WebRTC] Cleaning up');

    // Stop local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Unsubscribe from signaling channel
    if (this.signalChannel) {
      this.supabase.removeChannel(this.signalChannel);
      this.signalChannel = null;
    }

    this.remoteStream = null;
    this.iceCandidatesQueue = [];
    this.hasRemoteDescription = false;
  }
}

export default WebRTCVoiceCall;
