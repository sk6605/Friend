'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useConversations } from '@/app/context/ConversationContext';
import { useTheme } from '@/app/context/ThemeContext';
import AiAvatarToggle from './AiAvatarToggle';

interface SearchResult {
  id: string;
  title: string;
  updatedAt: string;
  snippet: string;
  matchRole: string;
  matchedAt: string;
  messageId: string;
}

interface SidebarProps {
  currentConversationId?: string;
  userId: string;
  onLogout: () => void;
  onOpenSettings?: () => void;
  onNavigate?: () => void;
  aiName?: string;
  profilePicture?: string | null;
  nickname?: string;
  persona?: string;
}

/**
 * Component: Sidebar
 * Manages navigation and conversation history.
 *
 * Features:
 * - Lists past conversations (fetched from /api/conversations).
 * - Supports creating new chats.
 * - Delete conversation functionality.
 * - Search functionality (via /api/conversations/search).
 * - User profile summary and settings toggle.
 * - Dark mode toggle.
 */
export default function Sidebar({ currentConversationId, userId, onLogout, onOpenSettings, onNavigate, aiName, profilePicture, nickname, persona }: SidebarProps) {
  const { conversations, fetchConversations, addConversation, removeConversation } = useConversations();
  const { isDark, toggle } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      await fetchConversations(userId);
      setIsLoading(false);
    })();
  }, [fetchConversations, userId]);

  const handleNewChat = async () => {
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '', userId }),
    });

    if (!res.ok) return;

    const conversation = await res.json();
    addConversation(conversation);
    router.push(`/chat/${conversation.id}`);
    onNavigate?.();
  };

  // ─── Delete Logic ───
  /**
   * Stops event propagation to prevent navigation when clicking delete.
   * Sets the item to be deleted in state.
   */
  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteTarget(id);
  };

  /**
   * Executes the API call to delete a conversation.
   * Updates local state on success to avoid page reload.
   */
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget;
    setDeleteTarget(null);

    try {
      const response = await fetch(`/api/conversations/${id}?userId=${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        removeConversation(id);
        if (currentConversationId === id) {
          router.push('/');
        }
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  // ─── Search Logic ───
  /**
   * doSearch(q)
   * Executes the actual API search request.
   * 1. Sets isSearching=true (loading state).
   * 2. Fetches matching messages from /api/conversations/search.
   * 3. Updates searchResults.
   */
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/conversations/search?userId=${userId}&q=${encodeURIComponent(q)}`);
      if (res.ok) {
        setSearchResults(await res.json());
      }
    } catch {
      // silently fail
    } finally {
      setIsSearching(false);
    }
  }, [userId]);

  /**
   * handleSearchChange(value)
   * Handles input with Debouncing (300ms).
   * 1. Updates UI immediately.
   * 2. Clears previous timer to prevent API spam.
   * 3. Sets new timer to call doSearch() after user stops typing.
   */
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!value.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    searchTimer.current = setTimeout(() => doSearch(value), 300);
  };

  // ─── Merging Results ───
  // Client-side filter: Matches Title instantly
  const filteredConversations = searchQuery.trim()
    ? conversations.filter(c =>
      c.title?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : conversations;

  // Server-side filter: Matches Message Content (loaded via API)
  // Excludes items already shown in title match to avoid duplicates.
  const additionalSearchResults = searchQuery.trim()
    ? searchResults.filter(r => !filteredConversations.some(c => c.id === r.id))
    : [];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else if (date.getFullYear() === today.getFullYear()) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
    }
  };

  return (
    <>
      <aside className="
        w-[260px] 
        bg-white/50 dark:bg-[#0f0e17]/50 backdrop-blur-2xl 
        border-r border-purple-100/30 dark:border-purple-800/15 
        h-full overflow-hidden flex flex-col
      ">
        {/* Header */}
        <div className="p-4 border-b border-purple-100/30 dark:border-purple-800/15">
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2">
              {profilePicture ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={profilePicture}
                  alt={nickname || 'User'}
                  className="w-8 h-8 rounded-full object-cover border border-purple-200 dark:border-purple-500/40"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-600/30 border border-purple-200 dark:border-purple-500/40 flex items-center justify-center text-sm font-bold text-purple-600 dark:text-purple-300">
                  {nickname ? nickname.charAt(0).toUpperCase() : '?'}
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-neutral-800 dark:text-white/90 leading-tight">{aiName || 'Lumi'}</span>
                {nickname && <span className="text-[11px] text-neutral-500 dark:text-slate-500 leading-tight">{nickname}</span>}
              </div>
            </div>
            <AiAvatarToggle persona={persona} />
          </div>
          <button
            onClick={handleNewChat}
            className="
              w-full px-4 py-2.5 rounded-xl
              bg-purple-50 dark:bg-purple-600/20 
              hover:bg-purple-100 dark:hover:bg-purple-600/30
              border border-purple-200 dark:border-purple-500/30
              text-purple-600 dark:text-purple-300 text-sm font-medium
              transition-all duration-200
              flex items-center justify-center gap-2
              hover:border-purple-300 dark:hover:border-purple-500/50
              active:scale-[0.98]
            "
          >
            <span className="text-lg leading-none">+</span>
            New chat
          </button>

          {/* Search */}
          <div className="relative mt-3">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 dark:text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search conversations..."
              className="
                w-full pl-9 pr-8 py-2 rounded-xl 
                bg-neutral-100 dark:bg-white/5 
                border border-transparent dark:border-purple-900/30 
                text-sm text-neutral-700 dark:text-slate-300 
                placeholder-neutral-400 dark:placeholder-slate-600 
                outline-none 
                focus:border-purple-300 dark:focus:border-purple-500/50 
                focus:bg-white dark:focus:bg-white/8 
                transition-all
              "
            />
            {searchQuery && (
              <button
                title="Clear search"
                onClick={() => handleSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto py-2">
          {isLoading ? (
            <div className="p-4 text-neutral-400 dark:text-purple-400/60 text-sm text-center">Loading...</div>
          ) : searchQuery.trim() && filteredConversations.length === 0 && additionalSearchResults.length === 0 && !isSearching ? (
            <div className="p-4 text-neutral-400 dark:text-purple-400/60 text-sm text-center">No results found</div>
          ) : !searchQuery.trim() && conversations.length === 0 ? (
            <div className="p-4 text-neutral-400 dark:text-purple-400/60 text-sm text-center">No conversations yet</div>
          ) : (
            <div className="space-y-0.5 px-3">
              {/* Title-matched conversations */}
              {(searchQuery.trim() ? filteredConversations : conversations)
                .filter(c => c?.id)
                .map(conversation => {
                  const matchResult = searchQuery.trim() ? searchResults.find(r => r.id === conversation.id) : null;
                  const href = matchResult
                    ? `/chat/${conversation.id}?highlight=${matchResult.messageId}&q=${encodeURIComponent(searchQuery)}`
                    : `/chat/${conversation.id}`;
                  const isActive = currentConversationId === conversation.id;

                  return (
                    <Link
                      key={conversation.id}
                      href={href}
                      onClick={() => { if (matchResult) { setSearchQuery(''); setSearchResults([]); } onNavigate?.(); }}
                      className={`
                        block group relative px-3 py-2.5 rounded-xl transition-all duration-200 
                        ${isActive
                          ? 'bg-purple-100 dark:bg-purple-600/25 text-purple-700 dark:text-white border border-purple-200 dark:border-purple-500/20 shadow-sm'
                          : 'text-neutral-600 dark:text-slate-400 hover:bg-neutral-50 dark:hover:bg-white/5 hover:text-neutral-800 dark:hover:text-slate-200 border border-transparent'
                        }
                      `}
                    >
                      <div className="pr-7 truncate text-sm font-medium">
                        {conversation.title || 'New Chat'}
                      </div>
                      <div className={`text-[11px] mt-0.5 ${isActive ? 'text-purple-500 dark:text-purple-200/70' : 'text-neutral-400 dark:text-slate-600'}`}>
                        {formatDate(conversation.updatedAt)}
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={e => handleDeleteClick(e, conversation.id)}
                        className="
                          absolute right-2 top-1/2 -translate-y-1/2 
                          opacity-0 group-hover:opacity-100 max-md:opacity-60 
                          transition-all duration-200 p-1 
                          hover:bg-red-500/10 dark:hover:bg-red-500/20 rounded-lg 
                          text-neutral-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400
                        "
                        aria-label="Delete conversation"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </Link>
                  );
                })}

              {/* Message-content search results (not already shown by title match) */}
              {additionalSearchResults.length > 0 && (
                <>
                  <div className="px-1 pt-3 pb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-slate-500">Messages</span>
                  </div>
                  {additionalSearchResults.map(result => (
                    <Link
                      key={`search-${result.id}`}
                      href={`/chat/${result.id}?highlight=${result.messageId}&q=${encodeURIComponent(searchQuery)}`}
                      onClick={() => { setSearchQuery(''); setSearchResults([]); onNavigate?.(); }}
                      className={`
                        block group relative px-3 py-2.5 rounded-xl transition-all duration-200 
                        ${currentConversationId === result.id
                          ? 'bg-purple-100 dark:bg-purple-600/25 text-purple-700 dark:text-white border border-purple-200 dark:border-purple-500/20'
                          : 'text-neutral-600 dark:text-slate-400 hover:bg-neutral-50 dark:hover:bg-white/5 hover:text-neutral-800 dark:hover:text-slate-200 border border-transparent'
                        }
                      `}
                    >
                      <div className="pr-7 truncate text-sm font-medium">
                        {result.title || 'New Chat'}
                      </div>
                      <div className="text-[11px] text-purple-500/70 dark:text-purple-400/70 mt-0.5 truncate italic">
                        {result.snippet}
                      </div>
                    </Link>
                  ))}
                </>
              )}

              {/* Searching indicator */}
              {isSearching && (
                <div className="px-3 py-2 text-[11px] text-neutral-400 dark:text-purple-400/60">
                  Searching messages...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-purple-100/30 dark:border-purple-800/15 p-3 space-y-2 bg-white/30 dark:bg-transparent">
          <Link
            href="/subscription"
            onClick={() => onNavigate?.()}
            className="
              w-full px-3 py-2 rounded-xl
              text-amber-600 dark:text-amber-400/80 hover:text-amber-700 dark:hover:text-amber-300 text-sm
              hover:bg-amber-50 dark:hover:bg-amber-500/10
              transition-all duration-200
              flex items-center gap-2
              border border-amber-500/20 hover:border-amber-500/30
            "
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
            </svg>
            Upgrade Plan
          </Link>
          <Link
            href="/insights"
            className="
              w-full px-3 py-2 rounded-xl
              text-emerald-600 dark:text-emerald-400/80 hover:text-emerald-700 dark:hover:text-emerald-300 text-sm
              hover:bg-emerald-50 dark:hover:bg-emerald-500/10
              transition-all duration-200
              flex items-center gap-2
              border border-emerald-500/20 hover:border-emerald-500/30
            "
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            Insights
          </Link>
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="
                w-full px-3 py-2 rounded-xl
                text-neutral-500 dark:text-slate-400 hover:text-neutral-800 dark:hover:text-white text-sm
                hover:bg-neutral-100 dark:hover:bg-white/5
                transition-all duration-200
                flex items-center gap-2
              "
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </button>
          )}
          <button
            onClick={onLogout}
            className="
              w-full px-3 py-2 rounded-xl
              text-red-500/70 hover:text-red-600 dark:text-red-400/70 dark:hover:text-red-400 text-sm
              hover:bg-red-50 dark:hover:bg-red-500/10
              transition-all duration-200
              flex items-center gap-2
            "
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            Logout
          </button>
        </div>

      </aside>

      {/* Custom Confirm Dialog — portaled to body so it escapes sidebar stacking context */}
      {deleteTarget && createPortal(
        <div
          className="fixed inset-0 z-9999 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirm delete conversation"
            className="
              bg-[#faf7f2] dark:bg-[#1e1b2e] rounded-2xl shadow-2xl shadow-purple-500/10
              border border-purple-100/60 dark:border-purple-800/40
              w-85 overflow-hidden
            "
            onClick={e => e.stopPropagation()}
          >
            <div className="pt-6 pb-2 flex justify-center">
              <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
            </div>
            <div className="px-6 pb-4 text-center">
              <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-100 mb-1">Delete conversation?</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">This action cannot be undone. All messages will be permanently deleted.</p>
            </div>
            <div className="flex border-t border-neutral-100 dark:border-neutral-700">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-3 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors border-r border-neutral-100 dark:border-neutral-700"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-3 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
