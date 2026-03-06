'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface ScheduleItem {
  id: string;
  subject: string;
  date: string;
  endTime?: string | null;
  type: string;
  source: string;
  notified: boolean;
}

interface SchedulePanelProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  meeting: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  event: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  task: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  reminder: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
};

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

// Convert Date to datetime-local input value in LOCAL time
function toLocalDatetimeValue(dateStr: string) {
  const d = new Date(dateStr);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export default function SchedulePanel({ userId, isOpen, onClose }: SchedulePanelProps) {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editDate, setEditDate] = useState('');

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // New item form
  const [showAdd, setShowAdd] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newType, setNewType] = useState('event');

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const to = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const res = await fetch(`/api/schedule?userId=${userId}&from=${from.toISOString()}&to=${to.toISOString()}`);
      if (res.ok) setItems(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => {
    if (isOpen) fetchSchedule();
  }, [isOpen, fetchSchedule]);

  const startEdit = (item: ScheduleItem) => {
    setEditingId(item.id);
    setEditSubject(item.subject);
    setEditDate(toLocalDatetimeValue(item.date));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditSubject('');
    setEditDate('');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await fetch(`/api/schedule/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          subject: editSubject,
          date: new Date(editDate).toISOString(),
        }),
      });
      setEditingId(null);
      fetchSchedule();
    } catch { /* ignore */ }
  };

  const deleteItem = async (id: string) => {
    try {
      await fetch(`/api/schedule/${id}?userId=${userId}`, { method: 'DELETE' });
      setItems(prev => prev.filter(i => i.id !== id));
    } catch { /* ignore */ }
  };

  const addItem = async () => {
    if (!newSubject || !newDate) return;
    try {
      await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          subject: newSubject,
          date: new Date(newDate).toISOString(),
          type: newType,
          source: 'manual',
        }),
      });
      setNewSubject('');
      setNewDate('');
      setNewType('event');
      setShowAdd(false);
      fetchSchedule();
    } catch { /* ignore */ }
  };

  if (!isOpen) return null;

  // Group items by date
  const grouped: Record<string, ScheduleItem[]> = {};
  for (const item of items) {
    const key = formatDate(item.date);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  }

  const panel = (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="
        relative w-full max-w-sm h-full
        bg-white dark:bg-[#1e1b2e]
        border-l border-purple-100 dark:border-purple-800/40
        shadow-2xl animate-slide-in-right
        flex flex-col
      ">
        {/* Header */}
        <div className="px-5 py-4 border-b border-purple-100 dark:border-purple-800/30 flex items-center gap-3">
          <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          <h2 className="text-base font-semibold text-neutral-800 dark:text-neutral-100 flex-1">
            Schedule
          </h2>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="p-1.5 rounded-lg text-purple-500 hover:bg-purple-50 dark:hover:bg-white/5 transition-colors"
            title="Add new"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Add new item form */}
        {showAdd && (
          <div className="px-5 py-3 border-b border-purple-100 dark:border-purple-800/30 space-y-2">
            <input
              type="text"
              placeholder="Subject..."
              value={newSubject}
              onChange={e => setNewSubject(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-purple-200 dark:border-purple-700/50 bg-white dark:bg-[#2a2440] text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
            <input
              type="datetime-local"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-purple-200 dark:border-purple-700/50 bg-white dark:bg-[#2a2440] text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-400 dark:scheme-dark"
            />
            <div className="flex gap-2">
              <select
                value={newType}
                onChange={e => setNewType(e.target.value)}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-purple-200 dark:border-purple-700/50 bg-white dark:bg-[#2a2440] text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-400"
              >
                <option value="event" className="bg-white dark:bg-[#2a2440] text-neutral-800 dark:text-neutral-100">Event</option>
                <option value="meeting" className="bg-white dark:bg-[#2a2440] text-neutral-800 dark:text-neutral-100">Meeting</option>
                <option value="task" className="bg-white dark:bg-[#2a2440] text-neutral-800 dark:text-neutral-100">Task</option>
                <option value="reminder" className="bg-white dark:bg-[#2a2440] text-neutral-800 dark:text-neutral-100">Reminder</option>
              </select>
              <button
                onClick={addItem}
                disabled={!newSubject || !newDate}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {/* Schedule items */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-neutral-400 dark:text-neutral-500">
                No upcoming schedule items
              </p>
              <p className="text-xs text-neutral-300 dark:text-neutral-600 mt-1">
                Mention events in chat and they will appear here automatically
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped).map(([dateLabel, dateItems]) => (
                <div key={dateLabel}>
                  <h3 className="text-xs font-semibold text-purple-500 dark:text-purple-400 uppercase tracking-wider mb-2">
                    {dateLabel}
                  </h3>
                  <div className="space-y-2">
                    {dateItems.map(item => (
                      <div
                        key={item.id}
                        className="
                          p-3 rounded-xl
                          bg-neutral-50 dark:bg-white/5
                          border border-neutral-100 dark:border-purple-800/20
                          hover:border-purple-200 dark:hover:border-purple-700/40
                          transition-colors group
                        "
                      >
                        {editingId === item.id ? (
                          /* Edit mode */
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editSubject}
                              onChange={e => setEditSubject(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-purple-300 dark:border-purple-600 bg-white dark:bg-[#2a2440] text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-400"
                            />
                            <input
                              type="datetime-local"
                              value={editDate}
                              onChange={e => setEditDate(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-purple-300 dark:border-purple-600 bg-white dark:bg-[#2a2440] text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-400 dark:scheme-dark"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={saveEdit}
                                className="px-3 py-1 text-xs font-medium rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition-colors"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="px-3 py-1 text-xs font-medium rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Display mode */
                          <div className="flex items-start gap-3">
                            <div className="text-xs font-mono text-neutral-400 dark:text-neutral-500 mt-0.5 min-w-[3rem]">
                              {formatTime(item.date)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100 truncate">
                                {item.subject}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${TYPE_COLORS[item.type] || TYPE_COLORS.event}`}>
                                  {item.type}
                                </span>
                                {item.source === 'ai' && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium">
                                    AI
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Edit / Delete buttons */}
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => startEdit(item)}
                                className="p-1 rounded text-neutral-400 hover:text-purple-500 transition-colors"
                                title="Edit"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m16.862 4.487 1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setDeletingId(item.id)}
                                className="p-1 rounded text-neutral-400 hover:text-red-500 transition-colors"
                                title="Delete"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delete confirmation dialog */}
        {deletingId && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setDeletingId(null)}>
            <div
              className="bg-white dark:bg-[#1e1b2e] rounded-2xl shadow-2xl border border-purple-100/60 dark:border-purple-800/40 w-72 overflow-hidden"
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
                <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 mb-0.5">Delete this event?</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">This cannot be undone.</p>
              </div>
              <div className="flex border-t border-neutral-100 dark:border-neutral-700">
                <button
                  onClick={() => setDeletingId(null)}
                  className="flex-1 py-2.5 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors border-r border-neutral-100 dark:border-neutral-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { deleteItem(deletingId); setDeletingId(null); }}
                  className="flex-1 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
