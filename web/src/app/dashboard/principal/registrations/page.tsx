'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Phone,
  Mail,
  Calendar,
  User,
  Baby,
  Bell,
  Search,
  Download,
  RefreshCw,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PrincipalShell } from '@/components/dashboard/principal/PrincipalShell';

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

export default function PrincipalRegistrationsPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [filteredRegistrations, setFilteredRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
  const [newRegistrationsCount, setNewRegistrationsCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [preschoolId, setPreschoolId] = useState<string | null>(null);

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
      
      // Get current user's preschool
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error('Auth error:', authError);
        setLoading(false);
        return;
      }

      // Get user's preschool_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('preschool_id')
        .eq('id', user.id)
        .single();

      if (profileError || !profile?.preschool_id) {
        console.error('No preschool found for user:', profileError);
        setLoading(false);
        return;
      }

      setPreschoolId(profile.preschool_id);
      console.log('📍 [Registrations] Fetching for preschool:', profile.preschool_id);

      // Connect to EduSitePro database
      const edusiteproUrl = process.env.NEXT_PUBLIC_EDUSITE_SUPABASE_URL || 'https://bppuzibjlxgfwrujzfsz.supabase.co';
      const edusiteproKey = process.env.NEXT_PUBLIC_EDUSITE_SUPABASE_ANON_KEY;

      if (!edusiteproKey) {
        console.error('❌ Missing NEXT_PUBLIC_EDUSITE_SUPABASE_ANON_KEY');
        setLoading(false);
        return;
      }

      console.log('🔗 [Registrations] Connecting to:', edusiteproUrl);

      const { createClient } = await import('@supabase/supabase-js');
      const edusiteproClient = createClient(edusiteproUrl, edusiteproKey);

      // Fetch registrations for this preschool only
      const { data, error } = await edusiteproClient
        .from('registration_requests')
        .select('*, organizations(name)')
        .eq('organization_id', profile.preschool_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log('✅ [Registrations] Found:', data?.length || 0, 'registrations');

      const formattedData = data?.map((reg: any) => ({
        ...reg,
        organization_name: reg.organizations?.name,
      })) || [];

      setRegistrations(formattedData);
      setFilteredRegistrations(formattedData);

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

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Initial fetch and set up real-time updates
  useEffect(() => {
    fetchRegistrations();
    
    // Poll every 30 seconds for new registrations
    const interval = setInterval(fetchRegistrations, 30000);
    
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter registrations
  useEffect(() => {
    let filtered = registrations;

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        r.guardian_name.toLowerCase().includes(term) ||
        r.guardian_email.toLowerCase().includes(term) ||
        r.student_first_name.toLowerCase().includes(term) ||
        r.student_last_name.toLowerCase().includes(term)
      );
    }

    setFilteredRegistrations(filtered);
  }, [registrations, statusFilter, searchTerm]);

  // Approve registration
  const handleApprove = async (registration: Registration) => {
    if (!confirm(`Approve registration for ${registration.student_first_name} ${registration.student_last_name}?`)) {
      return;
    }

    setProcessing(registration.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const edusiteproUrl = process.env.NEXT_PUBLIC_EDUSITE_SUPABASE_URL || 'https://bppuzibjlxgfwrujzfsz.supabase.co';
      const edusiteproKey = process.env.NEXT_PUBLIC_EDUSITE_SUPABASE_ANON_KEY;

      const { createClient } = await import('@supabase/supabase-js');
      const edusiteproClient = createClient(edusiteproUrl, edusiteproKey!);

      const { error } = await edusiteproClient
        .from('registration_requests')
        .update({
          status: 'approved',
          reviewed_by: user?.email,
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
      const { data: { user } } = await supabase.auth.getUser();
      
      const edusiteproUrl = process.env.NEXT_PUBLIC_EDUSITE_SUPABASE_URL || 'https://bppuzibjlxgfwrujzfsz.supabase.co';
      const edusiteproKey = process.env.NEXT_PUBLIC_EDUSITE_SUPABASE_ANON_KEY;

      const { createClient } = await import('@supabase/supabase-js');
      const edusiteproClient = createClient(edusiteproUrl, edusiteproKey!);

      const { error } = await edusiteproClient
        .from('registration_requests')
        .update({
          status: 'rejected',
          reviewed_by: user?.email,
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

  return (
    <PrincipalShell>
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <FileText className="w-8 h-8 text-blue-600" />
              Student Registrations
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Review and approve new student registrations
            </p>
          </div>
          
          <div className="mt-4 md:mt-0 flex items-center gap-4">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-lg ${soundEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}
              title="Toggle notification sound"
            >
              <Bell className="w-5 h-5" />
            </button>
            <button
              onClick={fetchRegistrations}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Pending', count: registrations.filter(r => r.status === 'pending').length, color: 'bg-yellow-100 text-yellow-700', icon: Clock },
            { label: 'Approved', count: registrations.filter(r => r.status === 'approved').length, color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
            { label: 'Rejected', count: registrations.filter(r => r.status === 'rejected').length, color: 'bg-red-100 text-red-700', icon: XCircle },
            { label: 'Total', count: registrations.length, color: 'bg-blue-100 text-blue-700', icon: FileText },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stat.count}</p>
                  </div>
                  <div className={`p-2 rounded-lg ${stat.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>

            {/* Export */}
            <button
              onClick={() => alert('Export functionality coming soon')}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              <Download className="w-5 h-5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Registrations List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-12 h-12 animate-spin mx-auto text-blue-600" />
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading registrations...</p>
            </div>
          ) : filteredRegistrations.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
              <FileText className="w-16 h-16 mx-auto text-gray-400" />
              <p className="mt-4 text-gray-600 dark:text-gray-400">No registrations found</p>
            </div>
          ) : (
            filteredRegistrations.map((reg) => (
              <div
                key={reg.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow hover:shadow-lg transition-all"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                          {reg.student_first_name} {reg.student_last_name}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          reg.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          reg.status === 'approved' ? 'bg-green-100 text-green-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {reg.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    
                    {reg.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApprove(reg)}
                          disabled={processing === reg.id}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(reg)}
                          disabled={processing === reg.id}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                          <XCircle className="w-5 h-5" />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <User className="w-4 h-4" />
                      <span><strong>Guardian:</strong> {reg.guardian_name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Mail className="w-4 h-4" />
                      <span>{reg.guardian_email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Phone className="w-4 h-4" />
                      <span>{reg.guardian_phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Baby className="w-4 h-4" />
                      <span><strong>DOB:</strong> {new Date(reg.student_dob).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Calendar className="w-4 h-4" />
                      <span><strong>Registered:</strong> {new Date(reg.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <FileText className="w-4 h-4" />
                      <span><strong>Documents:</strong> {reg.documents_uploaded ? '✓ Uploaded' : '✗ Pending'}</span>
                    </div>
                  </div>

                  {/* Payment Info */}
                  {reg.registration_fee_amount && (
                    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            Registration Fee: R{reg.registration_fee_amount.toFixed(2)}
                          </p>
                          {reg.campaign_applied && (
                            <p className="text-xs text-green-600 dark:text-green-400">
                              Discount: {reg.campaign_applied} (-R{reg.discount_amount?.toFixed(2) || '0.00'})
                            </p>
                          )}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          reg.registration_fee_paid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {reg.registration_fee_paid ? 'PAID' : 'PENDING'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Rejection Reason */}
                  {reg.status === 'rejected' && reg.rejection_reason && (
                    <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                        Rejection Reason:
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                        {reg.rejection_reason}
                      </p>
                    </div>
                  )}

                  {/* View Details Button */}
                  <button
                    onClick={() => setSelectedRegistration(reg)}
                    className="mt-4 text-blue-600 dark:text-blue-400 hover:underline text-sm"
                  >
                    View Full Details →
                  </button>
                </div>
              </div>
            ))
          )}
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
    </PrincipalShell>
  );
}
