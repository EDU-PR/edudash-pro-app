'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { ChatInterface } from '@/components/dash-chat/ChatInterface';
import { ConversationList } from '@/components/dash-chat/ConversationList';
import { QuotaProgress } from '@/components/dash-chat/QuotaProgress';
import { ArrowLeft, Sparkles, Menu, X } from 'lucide-react';

export default function TeacherDashChatPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState<string>('');
  const [userId, setUserId] = useState<string>();
  const { slug } = useTenantSlug(userId);
  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const [showSidebar, setShowSidebar] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Keyboard navigation - Escape to close sidebar
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showSidebar && isMobile) {
        setShowSidebar(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showSidebar, isMobile]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { 
        router.push('/sign-in'); 
        return; 
      }
      setEmail(session.user.email || '');
      setUserId(session.user.id);
      
      if (!activeConversationId) {
        setActiveConversationId(`dash_conv_${Date.now()}_${Math.random().toString(36).substring(7)}`);
      }
    })();
  }, [router, supabase.auth]);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setShowSidebar(false);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleNewConversation = () => {
    const newId = `dash_conv_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    setActiveConversationId(newId);
    if (isMobile) setShowSidebar(false);
  };

  const handleSelectConversation = (conversationId: string) => {
    setActiveConversationId(conversationId);
    if (isMobile) setShowSidebar(false);
  };

  return (
    <TeacherShell tenantSlug={slug} userEmail={email}>
      <div className="h-[calc(100vh-var(--topnav-h,64px)-var(--bottomnav-h,0px))] flex flex-col bg-gray-950 overflow-hidden">
        <header className="px-5 py-4 border-b border-gray-800 bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950 flex items-center justify-between gap-4 flex-shrink-0 sticky top-0 z-20 shadow-lg shadow-purple-900/10">
          <div className="flex items-center gap-4">
            {isMobile && (
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                aria-label={showSidebar ? 'Close conversations' : 'Open conversations'}
                aria-expanded={showSidebar}
                aria-controls="conversations-sidebar"
                className="inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-2 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 active:scale-95"
              >
                {showSidebar ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-600 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30 ring-2 ring-purple-400/20">
              <Sparkles size={24} color="white" aria-hidden="true" className="drop-shadow-md" />
            </div>
            <div>
              <h1 className="m-0 text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Dash AI</h1>
              <p className="m-0 text-xs text-gray-400 font-medium">
                Teaching Assistant
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleNewConversation}
              aria-label="Start new conversation"
              className="px-4 py-2.5 text-sm font-semibold rounded-xl inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white transition-all duration-200 shadow-lg shadow-purple-600/30 hover:shadow-xl hover:shadow-purple-600/40 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-gray-950"
            >
              <Sparkles size={16} aria-hidden="true" />
              New Chat
            </button>
          </div>
        </header>

        {/* Quota Progress Bar */}
        {userId && <QuotaProgress userId={userId} />}

        <div className="flex flex-1 overflow-hidden">
          <aside
            id="conversations-sidebar"
            className={`
              ${showSidebar && isMobile ? 'w-[85%] max-w-[320px]' : 'w-0'} md:w-80
              border-r border-gray-800
              overflow-hidden flex-shrink-0
              ${isMobile ? 'absolute z-20 h-full shadow-2xl shadow-black/50' : 'relative'}
              bg-gradient-to-b from-gray-950 to-gray-900
            `}
          >
            {(!isMobile || showSidebar) && (
              <ConversationList
                activeConversationId={activeConversationId}
                onSelectConversation={handleSelectConversation}
                onNewConversation={handleNewConversation}
              />
            )}
          </aside>

          <main className="flex-1 overflow-hidden flex flex-col">
            <ChatInterface
              conversationId={activeConversationId}
              onNewConversation={handleNewConversation}
            />
          </main>
        </div>

        {isMobile && showSidebar && (
          <div
            onClick={() => setShowSidebar(false)}
            onKeyDown={(e) => e.key === 'Enter' && setShowSidebar(false)}
            role="button"
            tabIndex={0}
            aria-label="Close sidebar overlay"
            className="fixed inset-0 bg-black/60 z-[15]"
          />
        )}
      </div>
    </TeacherShell>
  );
}
