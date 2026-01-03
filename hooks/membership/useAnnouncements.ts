/**
 * useAnnouncements Hook - React Query for Announcements Management
 * Handles fetching and creating announcements for Youth President
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'general' | 'event' | 'urgent' | 'update';
  audience: 'all' | 'members' | 'leaders';
  isPinned: boolean;
  createdAt: Date;
  author: string;
  readCount: number;
}

const MOCK_ANNOUNCEMENTS: Announcement[] = [
  {
    id: '1',
    title: 'Annual Youth Conference Registration Open',
    content: 'Registration for our 2025 Annual Youth Conference is now open! Early bird pricing available until January 31st.',
    type: 'event',
    audience: 'all',
    isPinned: true,
    createdAt: new Date(Date.now() - 86400000),
    author: 'Youth President',
    readCount: 145,
  },
  {
    id: '2',
    title: 'Leadership Training Workshop',
    content: 'Mandatory leadership training for all zone coordinators and committee heads this Saturday.',
    type: 'urgent',
    audience: 'leaders',
    isPinned: true,
    createdAt: new Date(Date.now() - 172800000),
    author: 'Youth President',
    readCount: 32,
  },
  {
    id: '3',
    title: 'Community Service Day Success',
    content: 'Thank you to all 78 volunteers who participated in our community service day. Together we cleaned 3 parks!',
    type: 'update',
    audience: 'all',
    isPinned: false,
    createdAt: new Date(Date.now() - 432000000),
    author: 'Events Team',
    readCount: 210,
  },
];

export function useAnnouncements(filter: string = 'all') {
  return useQuery({
    queryKey: ['announcements', filter],
    queryFn: async (): Promise<Announcement[]> => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (filter === 'all') return MOCK_ANNOUNCEMENTS;
      if (filter === 'pinned') return MOCK_ANNOUNCEMENTS.filter(a => a.isPinned);
      return MOCK_ANNOUNCEMENTS.filter(a => a.type === filter);
    },
    staleTime: 30000,
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (announcement: Omit<Announcement, 'id' | 'createdAt' | 'readCount'>) => {
      await new Promise(resolve => setTimeout(resolve, 500));
      return { ...announcement, id: Date.now().toString(), createdAt: new Date(), readCount: 0 };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });
}

export const ANNOUNCEMENT_TYPES = [
  { id: 'general', label: 'General', icon: 'information-circle', color: '#6366F1' },
  { id: 'event', label: 'Event', icon: 'calendar', color: '#10B981' },
  { id: 'urgent', label: 'Urgent', icon: 'alert-circle', color: '#EF4444' },
  { id: 'update', label: 'Update', icon: 'refresh-circle', color: '#F59E0B' },
] as const;

export const AUDIENCE_OPTIONS = [
  { id: 'all', label: 'Everyone' },
  { id: 'members', label: 'Members Only' },
  { id: 'leaders', label: 'Leaders Only' },
] as const;
