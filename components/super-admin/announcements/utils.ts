/**
 * Utility functions for announcements
 */

import { AnnouncementType, AnnouncementPriority } from './types';

// Get color for announcement type
export function getTypeColor(type: AnnouncementType): string {
  switch (type) {
    case 'alert':
      return '#dc2626';
    case 'warning':
      return '#ea580c';
    case 'maintenance':
      return '#7c3aed';
    case 'feature':
      return '#059669';
    case 'info':
    default:
      return '#0ea5e9';
  }
}

// Get color for priority
export function getPriorityColor(priority: AnnouncementPriority): string {
  switch (priority) {
    case 'urgent':
      return '#dc2626';
    case 'high':
      return '#ea580c';
    case 'medium':
      return '#d97706';
    case 'low':
      return '#059669';
    default:
      return '#6b7280';
  }
}

// Get icon for announcement type
export function getTypeIcon(type: AnnouncementType): string {
  switch (type) {
    case 'alert':
      return 'warning';
    case 'warning':
      return 'alert-circle';
    case 'maintenance':
      return 'construct';
    case 'feature':
      return 'sparkles';
    case 'info':
    default:
      return 'information-circle';
  }
}

// Format date for display
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Get audience display label
export function getAudienceLabel(audience: string): string {
  if (audience === 'all') return 'All Users';
  return audience.charAt(0).toUpperCase() + audience.slice(1).replace('_', ' ');
}

// Capitalize first letter
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
