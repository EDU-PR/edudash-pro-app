/* eslint-disable i18next/no-literal-string */
import { render, waitFor } from '@testing-library/react-native/pure';
import TeacherDashboardScreen from '@/app/screens/teacher-dashboard';

const mockReplace = jest.fn();
const mockUseAuth = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: any[]) => mockReplace(...args),
  },
  Stack: {
    Screen: () => null,
  },
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/contexts/ThemeContext', () => ({
  ThemeOverrideProvider: ({ children }: any) => children,
  useTheme: () => ({
    theme: {
      background: '#ffffff',
      text: '#111827',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string }) =>
      opts?.defaultValue || _key,
  }),
}));

jest.mock('@/components/layout/DesktopLayout', () => ({
  DesktopLayout: ({ children }: any) => {
    const { Text, View } = require('react-native');
    return (
      <View>
        <Text>DesktopLayout</Text>
        {children}
      </View>
    );
  },
}));

jest.mock('@/components/dashboard/NewEnhancedTeacherDashboard', () => ({
  NewEnhancedTeacherDashboard: () => {
    const { Text } = require('react-native');
    return <Text>Teacher Dashboard Wrapper</Text>;
  },
}));

describe('Teacher dashboard screen guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects to sign-in when unauthenticated', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      profile: null,
      profileLoading: false,
      loading: false,
    });

    render(<TeacherDashboardScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/sign-in');
    });
  });

  it('shows loading gate while auth/profile data is still loading', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      profile: null,
      profileLoading: true,
      loading: true,
    });

    const { getByText } = render(<TeacherDashboardScreen />);

    expect(getByText('Loading your profile...')).toBeTruthy();
  });

  it('renders the teacher dashboard for authenticated teachers', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'teacher-1' },
      profile: {
        id: 'teacher-1',
        role: 'teacher',
        organization_id: null,
        preschool_id: null,
      },
      profileLoading: false,
      loading: false,
    });

    const { getByText } = render(<TeacherDashboardScreen />);

    await waitFor(() => {
      expect(getByText('DesktopLayout')).toBeTruthy();
      expect(getByText('Teacher Dashboard Wrapper')).toBeTruthy();
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });
});
