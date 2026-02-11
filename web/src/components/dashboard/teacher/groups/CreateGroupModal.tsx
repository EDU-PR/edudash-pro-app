'use client';

import { FormEvent, useCallback, useState } from 'react';

export type GroupType = 'teacher_team' | 'grade_group' | 'subject_group' | 'study_group' | 'parent_group' | 'custom';

interface GroupTypeConfig {
  value: GroupType;
  label: string;
  color: string;
}

const GROUP_TYPES: GroupTypeConfig[] = [
  { value: 'teacher_team', label: 'Teacher Team', color: '#6366F1' },
  { value: 'grade_group', label: 'Grade Group', color: '#10B981' },
  { value: 'subject_group', label: 'Subject Group', color: '#F59E0B' },
  { value: 'study_group', label: 'Study Group', color: '#8B5CF6' },
  { value: 'parent_group', label: 'Parent Group', color: '#06B6D4' },
  { value: 'custom', label: 'Custom', color: '#64748B' },
];

interface CreateGroupModalProps {
  saving: boolean;
  onClose: () => void;
  onSubmit: (name: string, description: string, groupType: GroupType) => Promise<void>;
}

export function CreateGroupModal({ saving, onClose, onSubmit }: CreateGroupModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [groupType, setGroupType] = useState<GroupType>('teacher_team');

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      await onSubmit(name, description, groupType);
    },
    [description, groupType, name, onSubmit],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-5">
        <h2 className="text-xl font-semibold text-white mb-1">Create Group</h2>
        <p className="text-sm text-slate-400 mb-4">Set up a group for school coordination and communication.</p>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label className="text-xs text-slate-300 font-semibold block mb-1">Group name</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Grade R Teachers"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/50"
              maxLength={120}
              required
            />
          </div>

          <div>
            <label className="text-xs text-slate-300 font-semibold block mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What is this group for?"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/50"
              rows={3}
              maxLength={300}
            />
          </div>

          <div>
            <div className="text-xs text-slate-300 font-semibold mb-2">Group type</div>
            <div className="flex gap-2 flex-wrap">
              {GROUP_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setGroupType(type.value)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
                  style={{
                    borderColor: groupType === type.value ? type.color : 'rgba(148, 163, 184, 0.35)',
                    color: groupType === type.value ? '#fff' : '#cbd5e1',
                    background: groupType === type.value ? type.color : 'rgba(148, 163, 184, 0.08)',
                  }}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 text-sm font-semibold hover:bg-slate-800/60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
            >
              {saving ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
