'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Header, Footer } from '@/components';
import {
  FileText,
  Download,
  Eye,
  Users,
  MapPin,
  TrendingUp,
  Calendar,
  Settings,
  Shield,
  Printer,
  FolderOpen,
  ChevronRight,
  BarChart3,
  Bell,
  PenTool,
} from 'lucide-react';

// Document templates
const documentTemplates = [
  {
    id: 'blank-letterhead',
    name: 'Blank Letterhead',
    description: 'Official SOA letterhead for general correspondence',
    htmlFile: '/templates/soa-blank-letterhead.html',
    wordFile: '/templates/soa-blank-letterhead.doc',
    category: 'general',
  },
  {
    id: 'sanction-form',
    name: 'Sanction & Outcome Confirmation',
    description: 'Disciplinary decision confirmation form',
    htmlFile: '/templates/soa-letterhead.html',
    wordFile: '/templates/soa-sanction-form.doc',
    category: 'disciplinary',
  },
];

// Quick stats (placeholder data)
const stats = [
  { label: 'Total Members', value: '3,324', icon: Users, change: '+127 this month' },
  { label: 'Active Provinces', value: '9', icon: MapPin, change: 'All provinces active' },
  { label: 'Pending Actions', value: '12', icon: Bell, change: '3 require attention' },
  { label: 'Documents Issued', value: '156', icon: FileText, change: '+23 this week' },
];

export default function PresidentDashboardPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const handlePreview = (htmlFile: string) => {
    window.open(htmlFile, '_blank');
  };

  const handleDownloadWord = (wordFile: string, name: string) => {
    const link = document.createElement('a');
    link.href = wordFile;
    link.download = `${name.replace(/\s+/g, '-').toLowerCase()}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = (htmlFile: string) => {
    const printWindow = window.open(htmlFile, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <Header />

      <main className="flex-1 pt-20">
        {/* Header Section */}
        <section className="bg-gradient-to-r from-soa-dark to-soa-primary text-white py-8">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">President's Dashboard</h1>
                <p className="text-white/80">Manage documents, view analytics, and oversee operations</p>
              </div>
              <div className="hidden md:flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-white/60">Logged in as</p>
                  <p className="font-semibold">President</p>
                </div>
                <div className="w-12 h-12 bg-soa-gold rounded-full flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Stats */}
        <section className="py-6 -mt-6">
          <div className="container mx-auto px-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((stat, index) => (
                <div key={index} className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
                      <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                      <p className="text-xs text-soa-primary mt-1">{stat.change}</p>
                    </div>
                    <div className="w-10 h-10 bg-soa-primary/10 rounded-lg flex items-center justify-center">
                      <stat.icon className="w-5 h-5 text-soa-primary" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Main Content */}
        <section className="py-6">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Document Templates */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="p-5 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-soa-gold/20 rounded-lg flex items-center justify-center">
                          <FolderOpen className="w-5 h-5 text-soa-gold" />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-gray-900">Official Document Templates</h2>
                          <p className="text-sm text-gray-500">Download, edit, and distribute official forms</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-5 space-y-4">
                    {documentTemplates.map((template) => (
                      <div 
                        key={template.id}
                        className="border border-gray-200 rounded-xl p-4 hover:border-soa-primary transition"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-soa-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                              <FileText className="w-6 h-6 text-soa-primary" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">{template.name}</h3>
                              <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                              <div className="flex flex-wrap gap-2 mt-3">
                                <button
                                  onClick={() => handlePreview(template.htmlFile)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition"
                                >
                                  <Eye className="w-4 h-4" />
                                  Preview
                                </button>
                                <button
                                  onClick={() => handleDownloadWord(template.wordFile, template.name)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm hover:bg-blue-100 transition"
                                >
                                  <Download className="w-4 h-4" />
                                  Word (.doc)
                                </button>
                                <button
                                  onClick={() => handlePrint(template.htmlFile)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-soa-primary/10 text-soa-primary rounded-lg text-sm hover:bg-soa-primary/20 transition"
                                >
                                  <Printer className="w-4 h-4" />
                                  Print
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="p-5 border-t border-gray-200 bg-gray-50 rounded-b-xl">
                    <p className="text-sm text-gray-600">
                      <strong>Tip:</strong> Download the Word (.doc) file to edit in Microsoft Word, then save as PDF for distribution.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Actions Sidebar */}
              <div className="space-y-6">
                {/* Quick Actions */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="p-5 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900">Quick Actions</h2>
                  </div>
                  <div className="p-3">
                    {[
                      { label: 'View All Members', icon: Users, href: '/admin/members' },
                      { label: 'Regional Reports', icon: BarChart3, href: '/admin/reports' },
                      { label: 'Upcoming Events', icon: Calendar, href: '/admin/events' },
                      { label: 'Announcements', icon: Bell, href: '/admin/announcements' },
                      { label: 'Settings', icon: Settings, href: '/admin/settings' },
                    ].map((action, index) => (
                      <Link
                        key={index}
                        href={action.href}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition"
                      >
                        <div className="flex items-center gap-3">
                          <action.icon className="w-5 h-5 text-gray-400" />
                          <span className="text-gray-700">{action.label}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="p-5 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900">Recent Activity</h2>
                  </div>
                  <div className="p-5 space-y-4">
                    {[
                      { action: 'New member registered', location: 'Gauteng', time: '2 hours ago' },
                      { action: 'Document issued', location: 'KZN', time: '4 hours ago' },
                      { action: 'Event created', location: 'National', time: '1 day ago' },
                      { action: 'Regional report submitted', location: 'Western Cape', time: '2 days ago' },
                    ].map((activity, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-soa-primary rounded-full mt-2"></div>
                        <div>
                          <p className="text-sm text-gray-900">{activity.action}</p>
                          <p className="text-xs text-gray-500">{activity.location} • {activity.time}</p>
                        </div>
                      </div>
                    ))}
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
