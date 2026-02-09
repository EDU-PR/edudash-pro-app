import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native/pure';
import HiringView from '../HiringView';
import { TeacherInviteService } from '@/lib/services/teacherInviteService';
import * as Clipboard from 'expo-clipboard';

const mockShowAlert = jest.fn();

jest.mock('@/components/ui/AlertModal', () => ({
  useAlertModal: () => ({ showAlert: mockShowAlert }),
}));

jest.mock('@/lib/services/teacherInviteService', () => ({
  TeacherInviteService: {
    createInvite: jest.fn(),
    deleteInvite: jest.fn(),
  },
}));

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(async () => undefined),
}));

const mockCreateInvite =
  TeacherInviteService.createInvite as jest.MockedFunction<typeof TeacherInviteService.createInvite>;
const mockDeleteInvite =
  TeacherInviteService.deleteInvite as jest.MockedFunction<typeof TeacherInviteService.deleteInvite>;
const mockSetClipboard =
  Clipboard.setStringAsync as jest.MockedFunction<typeof Clipboard.setStringAsync>;

const theme = {
  primary: '#4F46E5',
  text: '#111827',
  textSecondary: '#6b7280',
  border: '#e5e7eb',
  cardBackground: '#ffffff',
  inputBackground: '#f9fafb',
  inputBorder: '#d1d5db',
  inputText: '#111827',
  surface: '#ffffff',
} as any;

function renderView(overrides: Partial<React.ComponentProps<typeof HiringView>> = {}) {
  const props: React.ComponentProps<typeof HiringView> = {
    availableTeachers: [],
    invites: [],
    hiringSearch: '',
    radiusKm: 10,
    loading: false,
    theme,
    userId: 'principal-1',
    preschoolId: 'school-1',
    schoolName: 'Gamma School',
    inviterName: 'Principal Demo',
    onSearchChange: jest.fn(),
    onRadiusChange: jest.fn(),
    onRefresh: jest.fn(),
    onLoadInvites: jest.fn(async () => undefined),
    showAlert: mockShowAlert,
    ...overrides,
  };

  return {
    ...render(<HiringView {...props} />),
    props,
  };
}

describe('HiringView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates an invite and opens share options', async () => {
    mockCreateInvite.mockResolvedValue({
      id: 'invite-1',
      school_id: 'school-1',
      email: 'teacher@example.com',
      token: 'token-abc',
      status: 'pending',
      invited_by: 'principal-1',
      expires_at: '2026-03-01T00:00:00.000Z',
      created_at: '2026-02-08T00:00:00.000Z',
    } as any);

    const onLoadInvites = jest.fn(async () => undefined);
    const { getByText } = renderView({
      availableTeachers: [
        {
          id: 'teacher-1',
          name: 'Jane Teacher',
          email: 'teacher@example.com',
        },
      ],
      onLoadInvites,
    });

    fireEvent.press(getByText('Invite'));

    await waitFor(() => {
      expect(mockCreateInvite).toHaveBeenCalledWith({
        schoolId: 'school-1',
        email: 'teacher@example.com',
        invitedBy: 'principal-1',
      });
    });

    expect(onLoadInvites).toHaveBeenCalledTimes(1);
    expect(
      mockShowAlert.mock.calls.some(([cfg]) => cfg?.title === 'Invite Ready')
    ).toBe(true);
  });

  it('supports invite share actions including quick copy link', async () => {
    const { getByText } = renderView({
      invites: [
        {
          id: 'invite-2',
          email: 'pending@example.com',
          token: 'pending-token',
          status: 'pending',
          created_at: '2026-02-08T00:00:00.000Z',
        },
      ],
    });

    fireEvent.press(getByText('Share Invite'));

    await waitFor(() => {
      const inviteReadyCall = mockShowAlert.mock.calls.find(([cfg]) => cfg?.title === 'Invite Ready')?.[0];
      expect(inviteReadyCall).toBeTruthy();
      expect(inviteReadyCall.buttons?.map((button: any) => button.text)).toEqual(
        expect.arrayContaining(['Share', 'WhatsApp', 'SMS', 'Email', 'Copy Link'])
      );
    });

    fireEvent.press(getByText('Copy Link'));

    await waitFor(() => {
      expect(mockSetClipboard).toHaveBeenCalledWith(
        expect.stringContaining('token=pending-token')
      );
    });

    expect(
      mockShowAlert.mock.calls.some(([cfg]) => cfg?.title === 'Link Copied')
    ).toBe(true);
  });

  it('deletes an invite after confirmation and refreshes invite list', async () => {
    mockDeleteInvite.mockResolvedValue(undefined);
    const onLoadInvites = jest.fn(async () => undefined);

    const { getByText } = renderView({
      invites: [
        {
          id: 'invite-3',
          email: 'remove@example.com',
          token: 'remove-token',
          status: 'pending',
          created_at: '2026-02-08T00:00:00.000Z',
        },
      ],
      onLoadInvites,
    });

    fireEvent.press(getByText('Delete'));

    const deletePrompt = mockShowAlert.mock.calls.find(
      ([cfg]) => cfg?.title === 'Delete Invite?'
    )?.[0];

    expect(deletePrompt).toBeTruthy();
    const confirmDelete = deletePrompt?.buttons?.find((button: any) => button.text === 'Delete');
    expect(confirmDelete?.onPress).toBeDefined();

    await act(async () => {
      await confirmDelete.onPress();
    });

    await waitFor(() => {
      expect(mockDeleteInvite).toHaveBeenCalledWith('invite-3', { schoolId: 'school-1' });
    });

    expect(onLoadInvites).toHaveBeenCalledTimes(1);
    expect(
      mockShowAlert.mock.calls.some(([cfg]) => cfg?.title === 'Invite Deleted')
    ).toBe(true);
  });
});
