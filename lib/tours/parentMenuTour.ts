/**
 * Parent Menu Tour Definition
 *
 * 3-step spotlight tour introducing the Weekly Menu feature to parents.
 * Auto-triggers on the parent dashboard when the feature is new.
 *
 * @module lib/tours/parentMenuTour
 */

import type { TourConfig } from '@/components/ui/SpotlightTour/types';

export const parentMenuTour: TourConfig = {
  id: 'parent-weekly-menu-v1',
  version: 1,
  roles: ['parent'],
  steps: [
    {
      targetKey: 'parent-menu-tile',
      title: 'Weekly Menu',
      description:
        "View your child's school breakfast, lunch, and snack menus — updated weekly by the school.",
      icon: 'restaurant-outline',
      tooltipPosition: 'below',
      spotlightShape: 'rectangle',
      spotlightPadding: 6,
    },
    {
      targetKey: 'parent-documents-tile',
      title: 'Documents',
      description:
        'Easily upload and manage documents like proof of payment, medical records, and ID copies.',
      icon: 'document-attach-outline',
      tooltipPosition: 'below',
      spotlightShape: 'rectangle',
      spotlightPadding: 6,
    },
    {
      targetKey: 'parent-announcements-tile',
      title: 'Stay Updated',
      description:
        'Check announcements for important school notices, events, and updates from teachers.',
      icon: 'megaphone-outline',
      tooltipPosition: 'below',
      spotlightShape: 'rectangle',
      spotlightPadding: 6,
    },
  ],
};
