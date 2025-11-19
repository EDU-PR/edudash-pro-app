'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PrincipalShell } from '@/components/dashboard/principal/PrincipalShell';
import { ChatInterface } from '@/components/dash-chat/ChatInterface';
import { ConversationList } from '@/components/dash-chat/ConversationList';
import { ExamBuilderLauncher } from '@/components/dash-chat/ExamBuilderLauncher';
import { QuotaProgress } from '@/components/dash-chat/QuotaProgress';
import { ArrowLeft, Sparkles, Menu, X, FileText } from 'lucide-react';

export default function PrincipalDashChatPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState<string>('');
  const [userId, setUserId] = useState<string>();
  const [preschoolName, setPreschoolName] = useState<string>();
  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const [showSidebar, setShowSidebar] = useState(false);
  const [showExamBuilder, setShowExamBuilder] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [quotaRefreshTrigger, setQuotaRefreshTrigger] = useState(0);
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Keyboard navigation - Escape to close overlays
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSidebar) setShowSidebar(false);
        if (showExamBuilder) setShowExamBuilder(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showSidebar, showExamBuilder]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/sign-in');
        return;
      }
      setEmail(session.user.email || '');
      setUserId(session.user.id);
      
      // Get preschool name
      const { data: profile } = await supabase
        .from('profiles')
        .select('preschool_id, preschools(name)')
        .eq('id', session.user.id)
        .single();
      
      if (profile?.preschools) {
        setPreschoolName((profile.preschools as any).name);
      }
    })();
  }, [router, supabase]);

  // Hydration flag
  useEffect(() => { setHydrated(true); }, []);

  // Auto-hide header on scroll down, show on scroll up
  useEffect(() => {
    let ticking = false;
    
    const handleScroll = (e: Event) => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const target = e.target as HTMLElement;
          const currentScrollY = target.scrollTop;
          
          // Show header when scrolling up or at top
          if (currentScrollY < lastScrollY || currentScrollY < 10) {
            setShowHeader(true);
          } 
          // Hide header when scrolling down (after 50px)
          else if (currentScrollY > lastScrollY && currentScrollY > 50) {
            setShowHeader(false);
          }
          
          setLastScrollY(currentScrollY);
          ticking = false;
        });
        ticking = true;
      }
    };

    // Wait for ChatMessages component to mount, then attach scroll listener
    const interval = setInterval(() => {
      const messagesContainer = document.querySelector('.flex-1.overflow-y-auto');
      if (messagesContainer) {
        messagesContainer.addEventListener('scroll', handleScroll, { passive: true });
        clearInterval(interval);
      }
    }, 100);

    return () => {
      clearInterval(interval);
      const messagesContainer = document.querySelector('.flex-1.overflow-y-auto');
      if (messagesContainer) {
        messagesContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, [lastScrollY]);

  const handleNewConversation = () => {
    const newId = `dash_conv_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    setActiveConversationId(newId);
    setShowSidebar(false);
  };

  const handleSelectConversation = (conversationId: string) => {
    setActiveConversationId(conversationId);
    setShowSidebar(false);
  };

  return (
    <PrincipalShell userEmail={email} preschoolName={preschoolName}>
      {/* Full viewport height container - No scroll */}
      <div
        className="flex flex-col bg-gray-950 overflow-hidden relative"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          height: '100dvh',
          maxHeight: '100dvh',
          paddingLeft: 'var(--sidebar-w, 0px)'
        }}
      >
        {/* Header - Auto-hiding on scroll */}
        <header className="flex-shrink-0 py-3 md:py-4 border-b border-gray-800/80 bg-gray-950/95 flex items-center justify-between gap-2 md:gap-3 z-20" style={{
          position: 'fixed',
          top: 'var(--topnav-h, 56px)',
          left: 0,
          right: 0,
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transform: showHeader ? 'translateY(0)' : 'translateY(-100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          <div className="flex items-center gap-3">
            {/* Mobile/Tablet toggle button - Enhanced touch target */}
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              aria-label={showSidebar ? 'Close conversations' : 'Open conversations'}
              aria-expanded={showSidebar}
              aria-controls="conversations-sidebar"
              className="inline-flex lg:hidden items-center justify-center bg-slate-900 hover:bg-slate-800 active:bg-slate-700 border border-gray-800 min-w-[44px] min-h-[44px] p-2 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-950"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {showSidebar ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            </button>

            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-purple-600 via-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-500/30">
                <Sparkles size={20} className="md:hidden" color="white" aria-hidden="true" />
                <Sparkles size={22} className="hidden md:block" color="white" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="m-0 text-base md:text-lg font-bold bg-gradient-to-r from-purple-200 to-pink-200 bg-clip-text text-transparent">Dash AI Assistant</h1>
                <p className="m-0 text-[11px] md:text-xs text-gray-400 truncate hidden sm:block">
                  Principal Dashboard • AI-Powered Support
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowExamBuilder(true)}
              aria-label="Create exam with AI"
              className="min-h-[44px] px-3 md:px-4 py-2 text-[13px] md:text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 active:scale-95 text-white border-0 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-950 shadow-lg shadow-purple-500/30"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <FileText size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Create Exam</span>
            </button>
            <button
              onClick={handleNewConversation}
              aria-label="Start new conversation"
              className="min-h-[44px] px-3 md:px-4 py-2 text-[13px] md:text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-950 shadow-lg shadow-purple-600/30"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <Sparkles size={16} aria-hidden="true" />
              <span className="hidden sm:inline">New Chat</span>
            </button>
          </div>
        </header>

        {/* Quota Progress Bar */}
        {userId && <QuotaProgress userId={userId} refreshTrigger={quotaRefreshTrigger} />}

        {/* Main Content - Takes remaining height */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Desktop Sidebar - Fixed position on desktop */}
          <aside
            id="conversations-sidebar"
            className="hidden lg:flex flex-col bg-gradient-to-b from-gray-950 to-gray-900 border-r border-gray-800 overflow-hidden"
            style={{
              position: 'fixed',
              left: 0,
              top: 'calc(var(--topnav-h, 56px) + 57px)',
              bottom: 0,
              width: '280px',
              zIndex: 10
            }}
          >
            <ConversationList
              activeConversationId={activeConversationId}
              onSelectConversation={handleSelectConversation}
              onNewConversation={handleNewConversation}
            />
          </aside>

          {/* Mobile Sidebar Overlay */}
          {hydrated && showSidebar && (
            <>
              <div
                onClick={() => setShowSidebar(false)}
                onKeyDown={(e) => e.key === 'Enter' && setShowSidebar(false)}
                role="button"
                tabIndex={0}
                aria-label="Close sidebar overlay"
                className="fixed inset-0 bg-black/60 z-[999] lg:hidden"
              />
              <aside
                id="conversations-sidebar"
                className="fixed top-10 left-0 bottom-0 w-[85%] max-w-[320px] bg-gradient-to-b from-gray-950 to-gray-900 z-[1000] flex flex-col shadow-2xl shadow-black/50 lg:hidden"
              >
                <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-950/80 backdrop-blur-sm">
                  <h2 className="m-0 text-base font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Conversations</h2>
                  <button
                    onClick={() => setShowSidebar(false)}
                    aria-label="Close conversations sidebar"
                    className="bg-gray-800 hover:bg-gray-700 border-0 p-2 cursor-pointer text-white rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <X size={20} aria-hidden="true" />
                  </button>
                </div>
                <ConversationList
                  activeConversationId={activeConversationId}
                  onSelectConversation={handleSelectConversation}
                  onNewConversation={handleNewConversation}
                />
              </aside>
            </>
          )}

          {/* Chat Area - Offset by sidebar on desktop */}
          <main className="flex-1 overflow-hidden flex flex-col relative" style={{
            marginLeft: 'var(--conversations-w, 0px)'
          }}>
            {hydrated && activeConversationId && (
              <ChatInterface
                conversationId={activeConversationId}
                onNewConversation={handleNewConversation}
                userId={userId}
                onMessageSent={() => setQuotaRefreshTrigger(prev => prev + 1)}
              />
            )}

            {hydrated && !activeConversationId && (
              <div className="flex flex-1 items-center justify-center overflow-hidden p-4">
                <div className="max-w-md w-full text-center flex flex-col items-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-600 via-purple-500 to-pink-500 flex items-center justify-center mb-2 shadow-2xl shadow-purple-500/40 animate-pulse" style={{ animationDuration: '3s' }}>
                    <Sparkles size={40} color="white" aria-hidden="true" />
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold m-0 bg-gradient-to-r from-purple-200 to-pink-200 bg-clip-text text-transparent">Welcome to Dash AI</h2>
                  <p className="text-sm md:text-base text-gray-400 m-0 leading-relaxed px-4">
                    Ask about school management, curriculum planning, student analytics, or create AI-powered assessments.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center w-full mt-4">
                    <button
                      onClick={handleNewConversation}
                      className="min-h-[48px] px-6 py-3 text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-950 shadow-xl shadow-purple-600/40"
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                      <Sparkles size={18} aria-hidden="true" />
                      Start Chatting
                    </button>
                    <button
                      onClick={() => setShowExamBuilder(true)}
                      className="min-h-[48px] px-6 py-3 text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 active:scale-95 text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-950 shadow-xl shadow-purple-500/40"
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                      <FileText size={18} aria-hidden="true" />
                      Create Exam
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Exam Builder Modal */}
            {hydrated && showExamBuilder && (
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Exam builder"
                className="absolute inset-0 z-[100]"
              >
                <ExamBuilderLauncher onClose={() => setShowExamBuilder(false)} />
              </div>
            )}
          </main>
        </div>
      </div>
    </PrincipalShell>
  );
}
