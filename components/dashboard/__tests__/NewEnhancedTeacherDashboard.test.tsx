import React from 'react';
import { render, fireEvent } from '@testing-library/react-native/pure';
import { NewEnhancedTeacherDashboard } from '../NewEnhancedTeacherDashboard';

const mockRefresh = jest.fn();
const mockUseTeacherDashboard = jest.fn();
const mockUseTeacherStudents = jest.fn();
const mockUseNewEnhancedTeacherState = jest.fn();

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: any) => <>{children}</>,
}));

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string }) =>
      opts?.defaultValue || _key,
  }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'teacher-1' },
    profile: { id: 'teacher-1', organization_id: 'org-1', role: 'teacher' },
  }),
}));

jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      primary: '#4F46E5',
      secondary: '#10B981',
      success: '#16A34A',
      warning: '#F59E0B',
      error: '#DC2626',
      text: '#111827',
      textSecondary: '#6B7280',
      background: '#FFFFFF',
    },
  }),
}));

jest.mock('@/contexts/DashboardPreferencesContext', () => ({
  useDashboardPreferences: () => ({
    preferences: {},
  }),
}));

jest.mock('@/hooks/useDashboardData', () => ({
  useTeacherDashboard: () => mockUseTeacherDashboard(),
}));

jest.mock('@/hooks/useTeacherStudents', () => ({
  useTeacherStudents: () => mockUseTeacherStudents(),
}));

jest.mock('@/hooks/useNewEnhancedTeacherState', () => ({
  useNewEnhancedTeacherState: () => mockUseNewEnhancedTeacherState(),
}));

jest.mock('@/lib/utils/tierUtils', () => ({
  getTierColor: () => '#4F46E5',
  getTierLabel: (tier: string) => tier.toUpperCase(),
}));

jest.mock('@/lib/analytics', () => ({
  track: jest.fn(),
}));

jest.mock('../PendingParentLinkRequests', () => ({
  PendingParentLinkRequests: () => {
    const React = require('react');
    const { Text } = require('react-native');
    return <Text>Parent Link Requests Widget</Text>;
  },
}));

jest.mock('../teacher/TeacherMetricsCard', () => ({
  TeacherMetricsCard: ({ title, value }: any) => {
    const React = require('react');
    const { Text } = require('react-native');
    return <Text>{`${title}: ${value}`}</Text>;
  },
}));

jest.mock('../teacher/TeacherQuickActionCard', () => ({
  TeacherQuickActionCard: ({ title, onPress }: any) => {
    const React = require('react');
    const { Text } = require('react-native');
    return <Text onPress={onPress}>{title}</Text>;
  },
}));

jest.mock('../teacher/BirthdayDonationRegister', () => ({
  BirthdayDonationRegister: () => {
    const React = require('react');
    const { Text } = require('react-native');
    return <Text>Birthday Donations</Text>;
  },
}));

jest.mock('@/components/dashboard/shared', () => ({
  CollapsibleSection: ({ title, children }: any) => {
    const React = require('react');
    const { Text, View } = require('react-native');
    return (
      <View>
        <Text>{title}</Text>
        {children}
      </View>
    );
  },
  StudentSummaryCard: ({ student }: any) => {
    const React = require('react');
    const { Text } = require('react-native');
    return <Text>{student.name || student.firstName || student.id}</Text>;
  },
}));

describe('NewEnhancedTeacherDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseTeacherStudents.mockReturnValue({
      students: [],
      loading: false,
    });

    mockUseNewEnhancedTeacherState.mockReturnValue({
      buildMetrics: () => [
        { title: 'Students', value: '3', icon: 'people', color: '#4F46E5' },
      ],
      buildQuickActions: () => [
        {
          id: 'create-lesson',
          title: 'Create Lesson',
          icon: 'book',
          color: '#4F46E5',
          category: 'lessons',
          onPress: jest.fn(),
        },
        {
          id: 'send-update',
          title: 'Send Update',
          icon: 'chatbubbles',
          color: '#10B981',
          category: 'communication',
          onPress: jest.fn(),
        },
      ],
      refreshing: false,
      handleRefresh: async (fn: () => Promise<void>) => fn(),
      getGreeting: () => 'Good morning',
      getContextualSubtitle: () => 'All set for today',
    });
  });

  it('renders loading state', () => {
    mockUseTeacherDashboard.mockReturnValue({
      data: null,
      loading: true,
      error: null,
      refresh: mockRefresh,
      isLoadingFromCache: false,
    });

    const { getByText } = render(<NewEnhancedTeacherDashboard />);

    expect(getByText('Loading dashboard...')).toBeTruthy();
  });

  it('renders error state and allows retry', () => {
    mockUseTeacherDashboard.mockReturnValue({
      data: null,
      loading: false,
      error: 'Network unavailable',
      refresh: mockRefresh,
      isLoadingFromCache: false,
    });

    const { getByText } = render(<NewEnhancedTeacherDashboard />);

    expect(getByText('Something went wrong')).toBeTruthy();
    expect(getByText('Network unavailable')).toBeTruthy();

    fireEvent.press(getByText('Try Again'));
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('renders highlights and quick actions when data is available', () => {
    mockUseTeacherDashboard.mockReturnValue({
      data: {
        schoolName: 'Gamma School',
        schoolTier: 'starter',
        totalStudents: 3,
        totalClasses: 1,
        upcomingLessons: 1,
        pendingGrading: 2,
        myClasses: [
          {
            id: 'class-1',
            name: 'Class A',
            studentCount: 3,
            grade: 'Grade R',
            room: 'R1',
            nextLesson: '09:00',
            presentToday: 2,
          },
        ],
        recentAssignments: [],
        upcomingEvents: [],
      },
      loading: false,
      error: null,
      refresh: mockRefresh,
      isLoadingFromCache: false,
    });

    const { getByText, getAllByText } = render(<NewEnhancedTeacherDashboard />);

    expect(getAllByText('Class A').length).toBeGreaterThan(0);
    expect(getByText('67%')).toBeTruthy();
    expect(getByText('Create Lesson')).toBeTruthy();
    expect(getByText('Send Update')).toBeTruthy();
  });
});
