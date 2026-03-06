'use client';

import { useState } from 'react';

interface Props {
  role: 'user' | 'assistant';
  content: string;
  messageId?: string;
  createdAt?: string;
  onDelete?: (messageId: string) => void;
  profilePicture?: string | null;
  nickname?: string;
  isHighlighted?: boolean;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return time;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
}

export default function ChatBubble({ role, content, messageId, createdAt, onDelete, profilePicture, nickname, isHighlighted }: Props) {
  const isUser = role === 'user';
  const [showConfirm, setShowConfirm] = useState(false);

  if (role === 'assistant' && content === '') {
    return (
      <div className="flex justify-start">
        <div className="px-5 py-3 rounded-2xl bg-white/70 dark:bg-white/10 border border-purple-100/40 dark:border-purple-800/30">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`group relative flex ${isUser ? 'justify-end' : 'justify-start'} items-end gap-1.5 mb-1 ${isHighlighted ? 'animate-highlight-flash' : ''}`}>
      {/* Delete button — left side for user messages */}
      {isUser && messageId && onDelete && (
        <button
          onClick={() => setShowConfirm(true)}
          className="opacity-0 group-hover:opacity-100 sm:opacity-0 max-sm:opacity-40 transition-opacity duration-200 mb-1 p-1 rounded-lg text-neutral-300 dark:text-neutral-600 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"
          aria-label="Delete message"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}

      <div
        className={`
          max-w-[75%]
          rounded-2xl
          text-sm
          leading-relaxed
          overflow-hidden
          ${isUser
            ? 'bg-purple-600 dark:bg-purple-700 text-white rounded-br-md shadow-md shadow-purple-200/40 dark:shadow-purple-900/40'
            : 'bg-white/80 dark:bg-[#1e1b2e] text-neutral-700 dark:text-neutral-200 border border-purple-100/40 dark:border-purple-800/30 rounded-bl-md shadow-sm'
          }
        `}
      >
        <div className="px-4 py-3 whitespace-pre-wrap">{content}</div>
      </div>

      {/* User avatar — right side */}
      {isUser && (
        <div className="w-7 h-7 rounded-full shrink-0 overflow-hidden bg-purple-500/20 flex items-center justify-center">
          {profilePicture ? (
            <img src={profilePicture} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs font-bold text-purple-400">
              {nickname ? nickname.charAt(0).toUpperCase() : 'U'}
            </span>
          )}
        </div>
      )}

      {/* Delete button — right side for assistant messages */}
      {!isUser && messageId && onDelete && (
        <button
          onClick={() => setShowConfirm(true)}
          className="opacity-0 group-hover:opacity-100 sm:opacity-0 max-sm:opacity-40 transition-opacity duration-200 mt-2.5 p-1 rounded-lg text-neutral-300 dark:text-neutral-600 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"
          aria-label="Delete message"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}

      {/* Timestamp — shown on hover */}
      {createdAt && (
        <div className={`absolute ${isUser ? 'right-0' : 'left-0'} -bottom-5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none`}>
          <span className="text-[10px] text-neutral-400 dark:text-neutral-600 whitespace-nowrap">{formatTime(createdAt)}</span>
        </div>
      )}

      {/* Confirm delete dialog */}
      {showConfirm && messageId && onDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowConfirm(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirm delete message"
            className="bg-white dark:bg-[#1e1b2e] rounded-2xl shadow-2xl border border-purple-100/60 dark:border-purple-800/40 w-80 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="pt-5 pb-2 flex justify-center">
              <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
            </div>
            <div className="px-5 pb-4 text-center">
              <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 mb-0.5">Delete this message?</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">This cannot be undone.</p>
            </div>
            <div className="flex border-t border-neutral-100 dark:border-neutral-700">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors border-r border-neutral-100 dark:border-neutral-700"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowConfirm(false); onDelete(messageId); }}
                className="flex-1 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
