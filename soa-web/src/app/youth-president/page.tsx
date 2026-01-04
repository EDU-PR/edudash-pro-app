'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header, Footer } from '@/components';
import {
  Users,
  Calendar,
  TrendingUp,
  Bell,
  ChevronRight,
  BarChart3,
  UserPlus,
  Wallet,
  School,
  Megaphone,
  MapPin,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { getSupabase } from '@/lib/supabase';

// Youth Wing Stats Interface
interface YouthStats {
  totalMembers: number;
  newThisMonth: number;
  activeEvents: number;
  pendingApprovals: number;
  ageBreakdown: {
    under18: number;
    age18to25: number;
    age26to35: number;
  };
}

// Quick Actions for Youth President
const quickActions = [
  { label: 'View All Members', icon: Users, href: '/youth/members', color: 'blue' },
  { label: 'Manage Events', icon: Calendar, href: '/youth/events', color: 'green' },
  { label: 'Programs', icon: School, href: '/youth/programs', color: 'purple' },
  { label: 'Budget Requests', icon: Wallet, href: '/youth/budget', color: 'amber' },
  { label: 'Announcements', icon: Megaphone, href: '/youth/announcements', color: 'cyan' },
  { label: 'Reports', icon: BarChart3, href: '/youth/reports', color: 'red' },
];

// Pending approval items
const pendingItems = [
  { 
    icon: UserPlus, 
    color: 'blue', 
    title: 'Membership Applications', 
    description: 'Youth members awaiting approval',
    href: '/youth/approvals/members',
    urgent: true,
  },
  { 
    icon: Wallet, 
    color: 'amber', 
    title: 'Budget Requests', 
    description: 'Program funding requests pending',
    href: '/youth/approvals/budget',
    urgent: false,
  },
  { 
    icon: Calendar, 
    color: 'green', 
    title: 'Event Proposals', 
    description: 'New events awaiting approval',
    href: '/youth/approvals/events',
    urgent: false,
  },
];

export default function YouthPresidentDashboardPage() {
  const [stats, setStats] = useState<YouthStats>({
    totalMembers: 0,
    newThisMonth: 0,
    activeEvents: 0,
    pendingApprovals: 0,
    ageBreakdown: { under18: 0, age18to25: 0, age26to35: 0 },
  });
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [recentMembers, setRecentMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchYouthData();
  }, []);

  const fetchYouthData = async () => {
    try {
      const supabase = getSupabase();
      
      // Get current user's org
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!profile?.organization_id) return;

      // Fetch youth members
      const { data: members } = await supabase
        .from('organization_members')
        .select('id, created_at, birth_year, first_name, last_name')
        .eq('organization_id', profile.organization_id)
        .in('member_type', ['youth', 'youth_member', 'youth_coordinator']);

      // Fetch pending approvals
      const { data: pending } = await supabase
        .from('organization_members')
        .select('id')
        .eq('organization_id', profile.organization_id)
        .eq('membership_status', 'pending')
        .in('member_type', ['youth', 'youth_member']);

      // Fetch upcoming events
      const { data: events } = await supabase
        .from('events')
        .select('id, title, start_date, location')
        .eq('organization_id', profile.organization_id)
        .gte('start_date', new Date().toISOString())
        .order('start_date', { ascending: true })
        .limit(5);

      // Calculate stats
      const currentYear = new Date().getFullYear();
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const ageBreakdown = { under18: 0, age18to25: 0, age26to35: 0 };
      members?.forEach(m => {
        if (m.birth_year) {
          const age = currentYear - m.birth_year;
          if (age < 18) ageBreakdown.under18++;
          else if (age <= 25) ageBreakdown.age18to25++;
          else if (age <= 35) ageBreakdown.age26to35++;
        }
      });

      const newThisMonth = members?.filter(m => 
        new Date(m.created_at) >= monthStart
      ).length || 0;

      setStats({
        totalMembers: members?.length || 0,
        newThisMonth,
        activeEvents: events?.length || 0,
        pendingApprovals: pending?.length || 0,
        ageBreakdown,
      });

      setUpcomingEvents(events || []);
      setRecentMembers(members?.slice(0, 5) || []);

    } catch (error) {
      console.error('Error fetching youth data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; bgLight: string }> = {
      blue: { bg: 'bg-blue-500', text: 'text-blue-600', bgLight: 'bg-blue-50' },
      green: { bg: 'bg-green-500', text: 'text-green-600', bgLight: 'bg-green-50' },
      purple: { bg: 'bg-purple-500', text: 'text-purple-600', bgLight: 'bg-purple-50' },
      amber: { bg: 'bg-amber-500', text: 'text-amber-600', bgLight: 'bg-amber-50' },
      cyan: { bg: 'bg-cyan-500', text: 'text-cyan-600', bgLight: 'bg-cyan-50' },
      red: { bg: 'bg-red-500', text: 'text-red-600', bgLight: 'bg-red-50' },
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <Header />

      <main className="flex-1 pt-20">
        {/* Header Section - Green gradient for Youth */}
        <section className="bg-gradient-to-r from-green-700 to-green-500 text-white py-8">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold">Youth President's Dashboard</h1>
                  <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">
                    YOUTH WING
                  </span>
                </div>
                <p className="text-white/80">Manage youth members, events, and programs</p>
              </div>
              <div className="hidden md:flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-white/60">Logged in as</p>
                  <p className="font-semibold">Youth President</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Stats */}
        <section className="py-6 -mt-6">
          <div className="container mx-auto px-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Total Youth Members</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalMembers}</p>
                    <p className="text-xs text-green-600 mt-1">+{stats.newThisMonth} this month</p>
                  </div>
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Upcoming Events</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.activeEvents}</p>
                    <p className="text-xs text-blue-600 mt-1">View calendar</p>
                  </div>
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Pending Approvals</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.pendingApprovals}</p>
                    <p className="text-xs text-amber-600 mt-1">Requires attention</p>
                  </div>
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Bell className="w-5 h-5 text-amber-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Growth Rate</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.totalMembers > 0 ? Math.round((stats.newThisMonth / stats.totalMembers) * 100) : 0}%
                    </p>
                    <p className="text-xs text-green-600 mt-1">Monthly growth</p>
                  </div>
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Main Content */}
        <section className="py-6">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Left Column - 2/3 */}
              <div className="lg:col-span-2 space-y-6">
                {/* Age Demographics */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="p-5 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900">Age Demographics</h2>
                    <p className="text-sm text-gray-500">Youth member distribution by age group</p>
                  </div>
                  <div className="p-5">
                    <div className="flex justify-around items-end h-48">
                      <div className="flex flex-col items-center">
                        <div 
                          className="w-16 bg-blue-500 rounded-t-lg transition-all"
                          style={{ height: `${Math.max(20, stats.ageBreakdown.under18 * 4)}px` }}
                        />
                        <p className="mt-3 text-xl font-bold text-gray-900">{stats.ageBreakdown.under18}</p>
                        <p className="text-sm text-gray-500">Under 18</p>
                      </div>
                      <div className="flex flex-col items-center">
                        <div 
                          className="w-16 bg-green-500 rounded-t-lg transition-all"
                          style={{ height: `${Math.max(20, stats.ageBreakdown.age18to25 * 4)}px` }}
                        />
                        <p className="mt-3 text-xl font-bold text-gray-900">{stats.ageBreakdown.age18to25}</p>
                        <p className="text-sm text-gray-500">18-25</p>
                      </div>
                      <div className="flex flex-col items-center">
                        <div 
                          className="w-16 bg-purple-500 rounded-t-lg transition-all"
                          style={{ height: `${Math.max(20, stats.ageBreakdown.age26to35 * 4)}px` }}
                        />
                        <p className="mt-3 text-xl font-bold text-gray-900">{stats.ageBreakdown.age26to35}</p>
                        <p className="text-sm text-gray-500">26-35</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Upcoming Events */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="p-5 border-b border-gray-200 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">Upcoming Events</h2>
                      <p className="text-sm text-gray-500">Youth wing activities and gatherings</p>
                    </div>
                    <Link 
                      href="/youth/events"
                      className="text-green-600 text-sm font-semibold hover:underline"
                    >
                      View All
                    </Link>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {upcomingEvents.length > 0 ? (
                      upcomingEvents.map((event) => (
                        <div key={event.id} className="p-4 hover:bg-gray-50 transition">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-green-100 rounded-xl flex flex-col items-center justify-center">
                              <span className="text-lg font-bold text-green-600">
                                {new Date(event.start_date).getDate()}
                              </span>
                              <span className="text-xs font-semibold text-green-600 uppercase">
                                {new Date(event.start_date).toLocaleString('default', { month: 'short' })}
                              </span>
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900">{event.title}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                <MapPin className="w-3 h-3 text-gray-400" />
                                <span className="text-sm text-gray-500">{event.location || 'TBA'}</span>
                              </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center">
                        <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No upcoming events</p>
                        <Link 
                          href="/youth/events/create"
                          className="mt-3 inline-block px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition"
                        >
                          Create Event
                        </Link>
                      </div>
                    )}
                  </div>
                </div>

                {/* Pending Approvals */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="p-5 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-bold text-gray-900">Pending Approvals</h2>
                      {stats.pendingApprovals > 0 && (
                        <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                          {stats.pendingApprovals}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {pendingItems.map((item, index) => {
                      const colors = getColorClasses(item.color);
                      return (
                        <Link
                          key={index}
                          href={item.href}
                          className="p-4 flex items-center justify-between hover:bg-gray-50 transition"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 ${colors.bgLight} rounded-lg flex items-center justify-center`}>
                              <item.icon className={`w-5 h-5 ${colors.text}`} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-gray-900">{item.title}</h3>
                                {item.urgent && (
                                  <AlertCircle className="w-4 h-4 text-red-500" />
                                )}
                              </div>
                              <p className="text-sm text-gray-500">{item.description}</p>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Column - 1/3 */}
              <div className="space-y-6">
                {/* Quick Actions */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="p-5 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900">Quick Actions</h2>
                  </div>
                  <div className="p-3">
                    {quickActions.map((action, index) => {
                      const colors = getColorClasses(action.color);
                      return (
                        <Link
                          key={index}
                          href={action.href}
                          className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 ${colors.bgLight} rounded-lg flex items-center justify-center`}>
                              <action.icon className={`w-4 h-4 ${colors.text}`} />
                            </div>
                            <span className="text-gray-700 font-medium">{action.label}</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </Link>
                      );
                    })}
                  </div>
                </div>

                {/* Recent Members */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="p-5 border-b border-gray-200 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-900">Recent Members</h2>
                    <Link 
                      href="/youth/members"
                      className="text-green-600 text-sm font-semibold hover:underline"
                    >
                      View All
                    </Link>
                  </div>
                  <div className="p-5 space-y-4">
                    {recentMembers.length > 0 ? (
                      recentMembers.map((member) => (
                        <div key={member.id} className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <span className="text-green-600 font-semibold text-sm">
                              {(member.first_name?.[0] || '') + (member.last_name?.[0] || '')}
                            </span>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-900">
                              {member.first_name} {member.last_name}
                            </p>
                            <p className="text-xs text-gray-500">
                              Joined {new Date(member.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <span className="bg-green-100 text-green-600 text-xs font-semibold px-2 py-1 rounded">
                            NEW
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4">
                        <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No recent members</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* System Status */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="p-5 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900">System Status</h2>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="text-sm text-gray-700">Platform Status</span>
                      </div>
                      <span className="text-sm font-semibold text-green-600">Online</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="text-sm text-gray-700">Database</span>
                      </div>
                      <span className="text-sm font-semibold text-green-600">Healthy</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-blue-500" />
                        <span className="text-sm text-gray-700">Last Sync</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-600">Just now</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
