'use client';

import { formatDistanceToNow } from 'date-fns';
import { Clock, PhoneIncoming, PhoneMissed, PhoneOff, PhoneOutgoing, Video } from 'lucide-react';
import type { CallRecord } from './types';
import { formatDuration, getContactName, getPeerId, isMissed } from './types';

interface CallHistoryItemProps {
  call: CallRecord;
  onVoiceCall: (peerId: string, peerName: string) => void;
  onVideoCall: (peerId: string, peerName: string) => void;
}

function getCallIcon(call: CallRecord) {
  if (call.call_type === 'video') return <Video size={18} style={{ color: '#a78bfa' }} />;
  if (isMissed(call.status)) return <PhoneMissed size={18} style={{ color: '#ef4444' }} />;
  if (call.status === 'declined') return <PhoneOff size={18} style={{ color: '#9ca3af' }} />;
  if (call.direction === 'incoming') return <PhoneIncoming size={18} style={{ color: '#10b981' }} />;
  return <PhoneOutgoing size={18} style={{ color: '#3b82f6' }} />;
}

export function CallHistoryItem({ call, onVoiceCall, onVideoCall }: CallHistoryItemProps) {
  const missed = isMissed(call.status);
  const peerName = getContactName(call);
  const peerId = getPeerId(call);

  return (
    <div
      className="rounded-lg border border-gray-700 bg-gray-900/40 px-3 py-3 flex flex-col md:flex-row md:items-center gap-3"
      style={{
        borderLeft: `3px solid ${missed ? '#ef4444' : call.direction === 'incoming' ? '#10b981' : '#3b82f6'}`,
      }}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: call.call_type === 'video' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)',
          }}
        >
          {getCallIcon(call)}
        </div>

        <div className="min-w-0">
          <div className="text-sm font-semibold text-white truncate">{peerName}</div>
          <div className="text-xs text-gray-400 flex items-center gap-2 flex-wrap">
            <span style={{ textTransform: 'capitalize' }}>
              {call.direction} {call.call_type}
            </span>
            <span>·</span>
            <Clock className="w-3.5 h-3.5" />
            <span>{formatDuration(call.duration_seconds)}</span>
            {missed && (
              <>
                <span>·</span>
                <span className="text-red-300 font-semibold">Missed</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between md:justify-end gap-3">
        <div className="text-xs text-gray-400 shrink-0">
          {formatDistanceToNow(new Date(call.started_at), { addSuffix: true })}
        </div>

        <div className="flex gap-1.5">
          <button
            onClick={() => onVoiceCall(peerId, peerName)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
            title="Call back (voice)"
          >
            Voice
          </button>
          <button
            onClick={() => onVideoCall(peerId, peerName)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
            title="Call back (video)"
          >
            Video
          </button>
        </div>
      </div>
    </div>
  );
}
