'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Phone,
  Mail,
  MapPin,
  Calendar,
  User,
  Baby,
  Bell,
  Filter,
  Search,
  Download,
  RefreshCw,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Registration {
  id: string;
  organization_id: string;
  organization_name?: string;
  // Guardian info
  guardian_name: string;
  guardian_email: string;
  guardian_phone: string;
  guardian_address: string;
  // Student info
  student_first_name: string;
  student_last_name: string;
  student_dob: string;
  student_gender: string;
  // Document URLs
  student_birth_certificate_url?: string;
  student_clinic_card_url?: string;
  guardian_id_document_url?: string;
  documents_uploaded: boolean;
  documents_deadline?: string;
  // Payment info
  registration_fee_amount?: number;
  registration_fee_paid: boolean;
  payment_method?: string;
  proof_of_payment_url?: string;
  campaign_applied?: string;
  discount_amount?: number;
  // Status
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  created_at: string;
}

export default function RegistrationsAdminPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [filteredRegistrations, setFilteredRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [organizationFilter, setOrganizationFilter] = useState<string>('all');
  const [organizations, setOrganizations] = useState<{id: string, name: string}[]>([]);
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
  const [newRegistrationsCount, setNewRegistrationsCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Notification sound
  const playNotificationSound = () => {
    if (soundEnabled && typeof Audio !== 'undefined') {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBze');
      audio.volume = 0.3;
      audio.play().catch(() => {}); // Ignore errors
    }
  };

  // Fetch registrations from EduSitePro database
  const fetchRegistrations = async () => {
    try {
      setLoading(true);
      
      // Connect to EduSitePro database (bppuzibjlxgfwrujzfsz.supabase.co)
      const edusiteproUrl = process.env.NEXT_PUBLIC_EDUSITE_SUPABASE_URL || 'https://bppuzibjlxgfwrujzfsz.supabase.co';
      const edusiteproKey = process.env.NEXT_PUBLIC_EDUSITE_SUPABASE_ANON_KEY;

      const { createClient } = await import('@supabase/supabase-js');
      const edusiteproClient = createClient(edusiteproUrl, edusiteproKey!);

      // Fetch all registrations
      const { data, error } = await edusiteproClient
        .from('registration_requests')
        .select('*, organizations(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedData = data?.map((reg: any) => ({
        ...reg,
        organization_name: reg.organizations?.name,
      })) || [];

      setRegistrations(formattedData);
      setFilteredRegistrations(formattedData);

      // Extract unique organizations
      const uniqueOrgs = Array.from(
        new Map(
          formattedData
            .filter((r: any) => r.organization_id && r.organization_name)
            .map((r: any) => [r.organization_id, { id: r.organization_id, name: r.organization_name }])
        ).values()
      );
      setOrganizations(uniqueOrgs);

      // Count new pending registrations
      const newPending = formattedData.filter((r: Registration) => r.status === 'pending').length;
      if (newPending > newRegistrationsCount) {
        playNotificationSound();
        if (Notification.permission === 'granted') {
          new Notification('New Registration!', {
            body: `${newPending - newRegistrationsCount} new registration(s) pending approval`,
            icon: '/icon-192.png',
          });
        }
      }
      setNewRegistrationsCount(newPending);

    } catch (error) {
      console.error('Error fetching registrations:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
          router.push('/sign-in');
          return;
        }
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Auth check error:', error);
        router.push('/sign-in');
      } finally {
        setAuthLoading(false);
      }
    };
    checkAuth();
  }, [router, supabase]);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Initial fetch and set up real-time updates
  useEffect(() => {
    if (!isAuthenticated) return;
    
    fetchRegistrations();
    
    // Poll every 30 seconds for new registrations
    const interval = setInterval(fetchRegistrations, 30000);
    
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Filter registrations
  useEffect(() => {
    let filtered = registrations;

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    // Organization filter
    if (organizationFilter !== 'all') {
      filtered = filtered.filter(r => r.organization_id === organizationFilter);
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        r.guardian_name.toLowerCase().includes(term) ||
        r.guardian_email.toLowerCase().includes(term) ||
        r.student_first_name.toLowerCase().includes(term) ||
        r.student_last_name.toLowerCase().includes(term) ||
        r.organization_name?.toLowerCase().includes(term)
      );
    }

    setFilteredRegistrations(filtered);
  }, [registrations, statusFilter, organizationFilter, searchTerm]);

  // Approve registration
  const handleApprove = async (registration: Registration) => {
    if (!confirm(`Approve registration for ${registration.student_first_name} ${registration.student_last_name}?`)) {
      return;
    }

    setProcessing(registration.id);
    try {
      const edusiteproUrl = process.env.NEXT_PUBLIC_EDUSITE_SUPABASE_URL || 'https://bppuzibjlxgfwrujzfsz.supabase.co';
      const edusiteproKey = process.env.NEXT_PUBLIC_EDUSITE_SUPABASE_ANON_KEY;

      const { createClient } = await import('@supabase/supabase-js');
      const edusiteproClient = createClient(edusiteproUrl, edusiteproKey!);

      // Get current user email for tracking
      const { data: { session } } = await supabase.auth.getSession();
      const reviewerEmail = session?.user?.email || 'admin';

      const { error } = await edusiteproClient
        .from('registration_requests')
        .update({
          status: 'approved',
          reviewed_by: reviewerEmail,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', registration.id);

      if (error) throw error;

      // Trigger sync to EduDashPro via Edge Function
      await edusiteproClient.functions.invoke('sync-registration-to-edudash', {
        body: { registration_id: registration.id },
      });

      await fetchRegistrations();
      alert('Registration approved successfully!');
    } catch (error) {
      console.error('Error approving registration:', error);
      alert('Failed to approve registration. Please try again.');
    } finally {
      setProcessing(null);
    }
  };

  // Reject registration
  const handleReject = async (registration: Registration) => {
    const reason = prompt(`Enter reason for rejecting ${registration.student_first_name} ${registration.student_last_name}'s registration:`);
    if (!reason) return;

    setProcessing(registration.id);
    try {
      const edusiteproUrl = process.env.NEXT_PUBLIC_EDUSITE_SUPABASE_URL || 'https://bppuzibjlxgfwrujzfsz.supabase.co';
      const edusiteproKey = process.env.NEXT_PUBLIC_EDUSITE_SUPABASE_ANON_KEY;

      const { createClient } = await import('@supabase/supabase-js');
      const edusiteproClient = createClient(edusiteproUrl, edusiteproKey!);

      // Get current user email for tracking
      const { data: { session } } = await supabase.auth.getSession();
      const reviewerEmail = session?.user?.email || 'admin';

      const { error } = await edusiteproClient
        .from('registration_requests')
        .update({
          status: 'rejected',
          reviewed_by: reviewerEmail,
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq('id', registration.id);

      if (error) throw error;

      await fetchRegistrations();
      alert('Registration rejected.');
    } catch (error) {
      console.error('Error rejecting registration:', error);
      alert('Failed to reject registration. Please try again.');
    } finally {
      setProcessing(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Registration Management
              </h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Review and approve registration requests from parents
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2 rounded-lg transition-colors ${soundEnabled ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                title="Toggle notification sound"
              >
                <Bell className="w-5 h-5" />
              </button>
              <button
                onClick={fetchRegistrations}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          {/* Stats Bar */}
          <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{registrations.length}</div>
                  <div className="text-xs text-gray-500">Total</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{registrations.filter(r => r.status === 'pending').length}</div>
                  <div className="text-xs text-gray-500">Pending</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{registrations.filter(r => r.status === 'approved').length}</div>
                  <div className="text-xs text-gray-500">Approved</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{registrations.filter(r => r.status === 'rejected').length}</div>
                  <div className="text-xs text-gray-500">Rejected</div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs and Filters */}
          <div className="border-b border-gray-200 dark:border-gray-700 px-6">
            <div className="flex items-center justify-between mb-4">
              {/* Status Tabs */}
              <div className="flex gap-1">
                {[
                  { value: 'all', label: 'All' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'rejected', label: 'Rejected' },
                ].map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setStatusFilter(tab.value as any)}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      statusFilter === tab.value
                        ? 'text-orange-600 border-b-2 border-orange-600'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Export Button */}
              <button
                onClick={() => alert('Export functionality coming soon')}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>

            {/* Search and Organization Filter */}
            <div className="flex gap-4 pb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <select
                value={organizationFilter}
                onChange={(e) => setOrganizationFilter(e.target.value)}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Schools</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Registrations Table */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Loading registrations...</p>
              </div>
            ) : filteredRegistrations.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto text-gray-400" />
                <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">No registrations found</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Student</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Parent</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">School</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Payment</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {
filteredRegistrations.map((reg) => (
                    <tr key={reg.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      {/* Student */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {reg.student_first_name} {reg.student_last_name}
                          </div>
                          <div className="text-xs text-gray-500">
                            DOB: {new Date(reg.student_dob).toLocaleDateString()}
                          </div>
                        </div>
                      </td>

                      {/* Parent */}
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm text-gray-900 dark:text-white">{reg.guardian_name}</div>
                          <div className="text-xs text-gray-500">{reg.guardian_email}</div>
                        </div>
                      </td>

                      {/* School */}
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {reg.organization_name || 'Unknown'}
                        </div>
                      </td>

                      {/* Fee */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {reg.registration_fee_amount ? `R${reg.registration_fee_amount}` : 'R300'}
                          {reg.discount_amount && reg.discount_amount > 0 && (
                            <div className="text-xs text-green-600">{reg.discount_amount}% off</div>
                          )}
                        </div>
                      </td>

                      {/* Payment */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          reg.registration_fee_paid
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {reg.registration_fee_paid ? 'Paid' : 'No Payment'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          reg.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                          reg.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                          'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {reg.status}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {new Date(reg.created_at).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {reg.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleApprove(reg)}
                              disabled={processing === reg.id}
                              className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                              title="Approve"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleReject(reg)}
                              disabled={processing === reg.id}
                              className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                              title="Reject"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setSelectedRegistration(reg)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
                          >
                            View
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                }
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Detail Modal */}
        {selectedRegistration && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Registration Details
                  </h2>
                  <button
                    onClick={() => setSelectedRegistration(null)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>

                {/* Full registration details would go here */}
                <div className="space-y-4">
                  <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto text-xs">
                    {JSON.stringify(selectedRegistration, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
