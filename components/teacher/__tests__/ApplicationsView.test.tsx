import React from 'react';
import { FlatList } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native/pure';
import { ApplicationsView } from '../ApplicationsView';
import { HiringHubService } from '../../../lib/services/HiringHubService';
import { ApplicationStatus, type ApplicationWithDetails } from '../../../types/hiring';

jest.mock('../../../lib/services/HiringHubService', () => ({
  HiringHubService: {
    getApplicationsForSchool: jest.fn(),
    reviewApplication: jest.fn(),
  },
}));

const mockGetApplicationsForSchool =
  HiringHubService.getApplicationsForSchool as jest.MockedFunction<typeof HiringHubService.getApplicationsForSchool>;
const mockReviewApplication =
  HiringHubService.reviewApplication as jest.MockedFunction<typeof HiringHubService.reviewApplication>;

const theme = {
  primary: '#4F46E5',
  text: '#111827',
  textSecondary: '#6b7280',
  border: '#e5e7eb',
  cardBackground: '#ffffff',
  surface: '#ffffff',
} as any;

function makeApplication(overrides: Partial<ApplicationWithDetails>): ApplicationWithDetails {
  return {
    id: 'app-default',
    job_posting_id: 'job-1',
    candidate_profile_id: 'candidate-1',
    status: ApplicationStatus.NEW,
    cover_letter: null,
    resume_file_path: null,
    applied_at: '2026-02-08T08:00:00.000Z',
    candidate_name: 'Default Candidate',
    candidate_email: 'candidate@example.com',
    candidate_phone: '+27123456789',
    candidate_experience_years: 3,
    job_title: 'Teacher',
    has_resume: false,
    ...overrides,
  };
}

describe('ApplicationsView', () => {
  const showAlert = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows friendly policy error messaging and only alerts once across retries', async () => {
    mockGetApplicationsForSchool.mockRejectedValue(
      new Error('Failed to fetch applications: permission denied for table users')
    );

    const { getByText, UNSAFE_getByType } = render(
      <ApplicationsView
        preschoolId="school-1"
        userId="principal-1"
        theme={theme}
        showAlert={showAlert}
      />
    );

    await waitFor(() => {
      expect(getByText('Applications are temporarily unavailable due to a database policy issue.')).toBeTruthy();
    });

    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledTimes(1);
      expect(showAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Applications Unavailable',
          type: 'warning',
          message: 'Applications are temporarily unavailable due to a database policy issue.',
        })
      );
    });

    const list = UNSAFE_getByType(FlatList);
    await act(async () => {
      await list.props.refreshControl.props.onRefresh();
    });

    expect(mockGetApplicationsForSchool).toHaveBeenCalledTimes(2);
    expect(showAlert).toHaveBeenCalledTimes(1);
  });

  it('supports status transitions and refreshes list after confirmation', async () => {
    mockGetApplicationsForSchool.mockResolvedValue([
      makeApplication({
        id: 'app-1',
        candidate_name: 'Jane Doe',
        candidate_email: 'jane@example.com',
        status: ApplicationStatus.NEW,
      }),
    ]);
    mockReviewApplication.mockResolvedValue({} as any);

    const { getByText } = render(
      <ApplicationsView
        preschoolId="school-1"
        userId="principal-1"
        theme={theme}
        showAlert={showAlert}
      />
    );

    await waitFor(() => {
      expect(getByText('Jane Doe')).toBeTruthy();
      expect(getByText('Review')).toBeTruthy();
    });

    fireEvent.press(getByText('Review'));

    const updatePrompt = showAlert.mock.calls.find(
      ([cfg]) => cfg?.title === 'Update Status'
    )?.[0];

    expect(updatePrompt).toBeTruthy();
    const confirmButton = updatePrompt?.buttons?.find((button: any) => button.text === 'Confirm');
    expect(confirmButton?.onPress).toBeDefined();

    await act(async () => {
      await confirmButton.onPress();
    });

    await waitFor(() => {
      expect(mockReviewApplication).toHaveBeenCalledWith(
        { application_id: 'app-1', status: ApplicationStatus.UNDER_REVIEW },
        'principal-1'
      );
    });

    expect(mockGetApplicationsForSchool).toHaveBeenCalledTimes(2);

    expect(
      showAlert.mock.calls.some(([cfg]) => cfg?.title === 'Updated')
    ).toBe(true);
  });

  it('filters applications by selected status chip', async () => {
    mockGetApplicationsForSchool.mockResolvedValue([
      makeApplication({
        id: 'app-new',
        candidate_name: 'Alpha New',
        status: ApplicationStatus.NEW,
      }),
      makeApplication({
        id: 'app-review',
        candidate_name: 'Beta Reviewing',
        status: ApplicationStatus.UNDER_REVIEW,
      }),
    ]);

    const { getByText, queryByText } = render(
      <ApplicationsView
        preschoolId="school-1"
        userId="principal-1"
        theme={theme}
        showAlert={showAlert}
      />
    );

    await waitFor(() => {
      expect(getByText('Alpha New')).toBeTruthy();
      expect(getByText('Beta Reviewing')).toBeTruthy();
      expect(getByText('Reviewing (1)')).toBeTruthy();
    });

    fireEvent.press(getByText('Reviewing (1)'));

    await waitFor(() => {
      expect(queryByText('Alpha New')).toBeNull();
      expect(getByText('Beta Reviewing')).toBeTruthy();
    });
  });
});
