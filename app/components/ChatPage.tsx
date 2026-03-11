'use client';

import { useState, useEffect, useRef } from 'react';
import ChatBubble from '@/app/components/ChatBubble';
import ChatInput from '@/app/components/ChatInput';
import ChatHeader from '@/app/components/Header';


import { useConversations } from '@/app/context/ConversationContext';
import MoodSelector from '@/app/components/MoodSelect';
import { useVoice } from '@/app/hooks/useVoice';
import VoiceVisualizer from '@/app/components/VoiceVisualizer';
import DailyChallengeCard from '@/app/components/DailyChallengeCard';

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
}

interface ChatPageProps {
  conversationId?: string;
  userId: string;
  aiName?: string;
  language?: string;
  profilePicture?: string | null;
  nickname?: string;
  onOpenSidebar?: () => void;
  highlightMessageId?: string;
  searchQuery?: string;
}

// ─── Localized greetings ───
const greetings: Record<string, { newChat: string; moodCheck: string }> = {
  en: {
    newChat: "Hey! Good to see you here. What's on your mind today? 😊",
    moodCheck: "Hey, it's been a while! How are you feeling today? 😊",
  },
  zh: {
    newChat: "嗨！很高兴见到你~今天想聊点什么？😊",
    moodCheck: "嗨，好久不见！你今天心情怎么样？😊",
  },
  es: {
    newChat: "Hola! Me alegra verte por aqui. Que tienes en mente hoy? 😊",
    moodCheck: "Hola, cuanto tiempo! Como te sientes hoy? 😊",
  },
  ja: {
    newChat: "やあ！会えて嬉しいよ。今日は何を話そうか？😊",
    moodCheck: "やあ、久しぶり！今日の気分はどう？😊",
  },
  ms: {
    newChat: "Hai! Seronok jumpa anda. Apa yang ada dalam fikiran hari ini? 😊",
    moodCheck: "Hai, lama tak jumpa! Apa perasaan anda hari ini? 😊",
  },
  ko: {
    newChat: "안녕! 만나서 반가워요. 오늘 무슨 이야기 할까요? 😊",
    moodCheck: "안녕, 오랜만이에요! 오늘 기분이 어때요? 😊",
  },
};

function getGreeting(lang: string | undefined, type: 'newChat' | 'moodCheck'): string {
  const key = lang && greetings[lang] ? lang : 'en';
  return greetings[key][type];
}

/**
 * Component: ChatPage
 * The core chat interface of the application.
 *
 * Features:
 * - Real-time streaming chat with OpenAI (via /api/chat).
 * - Voice input/output integration (Web Speech API).
 * - Dynamic background and UI themes.
 * - Auto-scroll and message virtualization support.
 * - Integration with Schedule, Mood, and Daily Challenges.
 * - Handles "Safe Mode" triggers and banners.
 *
 * Props:
 * - userId: Current user's ID.
 * - conversationId: Active conversation (optional).
 * - aiName/nickname: Personalization.
 */
import { useChatStream } from '@/app/hooks/useChatStream';
import { useSafeMode } from '@/app/hooks/useSafeMode';

export default function ChatPage({ conversationId, userId, aiName, language, profilePicture, nickname, onOpenSidebar, highlightMessageId, searchQuery }: ChatPageProps) {

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [highlightId, setHighlightId] = useState<string | undefined>(highlightMessageId);
  const [searchNotification, setSearchNotification] = useState<string | null>(null);

  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const { addConversation, updateConversationTitle } = useConversations();
  const [moodchoose, setMoodchoose] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [streak, setStreak] = useState(0);
  const { isListening, isSpeaking, transcript, error: voiceError, startListening, stopListening, speak, cancelSpeech, resetTranscript, timeRemaining, maxDuration } = useVoice(language);
  const prevListeningRef = useRef(isListening);

  const { hasSafeMode, triggerSafeMode, syncSafeModeConversations } = useSafeMode();


  const {
    messages,
    setLocalMessages: setMessages,
    currentConvId,
    setCurrentConvId,
    isLoading,
    isStreaming,
    handleSendMessage
  } = useChatStream({
    userId,
    initialConvId: conversationId,
    addConversation,
    updateConversationTitle,
    onSafeModeTrigger: triggerSafeMode,
    isVoice: isListening || isSpeaking,
    speak: speak,
    checkSafeMode: hasSafeMode
  });

  const safeMode = currentConvId ? hasSafeMode(currentConvId) : false;

  // Time-based Proactive Greeting
  useEffect(() => {
    const hasGreeted = sessionStorage.getItem('daily_greeting');
    if (!hasGreeted && messages.length > 0) { // Only if chat is loaded/active
      const now = new Date();
      const hour = now.getHours();
      let greeting = "";

      const lang = language || 'en';

      if (hour >= 6 && hour < 12) {
        greeting = lang === 'en' ? "Good morning! ☀️ Ready to start the day?"
          : lang === 'zh' ? "早上好！☀️ 准备好开始新的一天了吗？"
            : "Good morning! ☀️";
      } else if (hour >= 12 && hour < 14) {
        greeting = lang === 'en' ? "It's lunch time! 🍱 Don't forget to eat something."
          : lang === 'zh' ? "午餐时间到了！🍱 别忘了吃点东西哦。"
            : "Lunch time! 🍱";
      } else if (hour >= 22 || hour < 5) {
        greeting = lang === 'en' ? "Getting late... 🌙 Remember to rest well."
          : lang === 'zh' ? "时间不早了... 🌙 记得早点休息。"
            : "Getting late... 🌙";
      }

      if (greeting) {
        // We don't save this to DB to avoid cluttering history permanently with time checks,
        // or we DO save it if we want it to be part of the flow. 
        // For now, let's just add it locally as a 'system' or 'assistant' message.
        // Actually sticky system message might be better, but let's append to chat for now.
        setMessages((prev: Message[]) => [...prev, { role: 'assistant', content: greeting, id: 'proactive-greeting' }]);
        sessionStorage.setItem('daily_greeting', 'true');
      }
    }
  }, [messages.length, language, setMessages]);

  // Auto-send when listening stops
  useEffect(() => {
    if (prevListeningRef.current && !isListening && transcript.trim()) {
      handleSendMessage(transcript);
      resetTranscript();
    }
    prevListeningRef.current = isListening;
  }, [isListening, transcript, handleSendMessage, resetTranscript]);

  // Handle interrupting speech
  useEffect(() => {
    if (isListening) cancelSpeech();
  }, [isListening, cancelSpeech]);

  // Show voice error
  useEffect(() => {
    if (voiceError) {
      alert(voiceError); // Simple alert for now, or use a toast
    }
  }, [voiceError]);


  useEffect(() => {
    // Fetch streak
    if (userId) {
      fetch(`/api/users/${userId}/streak`)
        .then(res => res.ok ? res.json() : { streak: 0 })
        .then(data => setStreak(data.streak))
        .catch(() => { });
    }
  }, [userId]);

  // Check SAFE_MODE status on mount
  useEffect(() => {
    if (!userId) return;
    fetch(`/api/users/${userId}/safemode`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.safeModeConversationIds?.length > 0) {
          syncSafeModeConversations(data.safeModeConversationIds);
        }
      })
      .catch(() => { /* ignore */ });
  }, [userId, syncSafeModeConversations]);

  // Scroll to bottom whenever messages change or stream updates
  const scrollToBottom = () => {
    setTimeout(() => {
      if (bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }, 0);
  };

  // Scroll to highlighted message after messages load, otherwise scroll to bottom
  useEffect(() => {
    if (highlightId && messages.length > 0 && messages.some(m => m.id === highlightId)) {
      // Scroll to the highlighted message
      setTimeout(() => {
        const el = document.getElementById(`msg-${highlightId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Show notification
          setSearchNotification(searchQuery ? `Found "${searchQuery}"` : 'Found matched message');
          // Clear notification after 3s
          setTimeout(() => setSearchNotification(null), 3000);
          // Clear highlight after 2s animation
          setTimeout(() => setHighlightId(undefined), 2500);
        }
      }, 100);
      return;
    }
    scrollToBottom();
  }, [messages, highlightId, searchQuery]);

  // Also scroll when loading state changes (for thinking indicator)
  useEffect(() => {
    if (isLoading) {
      scrollToBottom();
    }
  }, [isLoading]);

  const isMoreThan2Hours = (dateString: string) => {
    const last = new Date(dateString).getTime();
    const now = Date.now();
    return now - last > 2 * 60 * 60 * 1000;
  }

  const createMoodConversation = async () => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'New day mood check',
          userId,
        }),
      });

      const newConv = await res.json();

      addConversation(newConv);
      setCurrentConvId(newConv.id);

      setMessages([
        {
          role: 'assistant',
          content: getGreeting(language, 'moodCheck'),
          id: 'mood-selector',
        },
      ]);

    } catch (err) {
      console.error('create mood conversation error:', err);
    }
  };


  const loadConversation = async (id: string, checkMood: boolean = false) => {
    try {
      setIsLoadingConversation(true);
      const response = await fetch(`/api/conversations/${id}?userId=${userId}`);

      if (response.ok) {
        const conversation: Conversation = await response.json();
        const msgs = conversation.messages || [];

        // Case 1: brand new chat
        if (msgs.length === 0) {
          setMessages([
            {
              role: 'assistant',
              content: getGreeting(language, 'newChat'),
            },
          ]);
          return;
        }

        // Case 2: mood check-in — only on auto-load (first visit), once per session
        if (checkMood) {
          const lastMsg = msgs[msgs.length - 1];
          const alreadyChecked = sessionStorage.getItem('mood_checked');

          if (
            !alreadyChecked &&
            lastMsg.createdAt &&
            isMoreThan2Hours(lastMsg.createdAt)
          ) {
            sessionStorage.setItem('mood_checked', '1');
            await createMoodConversation();
            return;
          }
        }

        // Normal: show the conversation messages
        setMessages(msgs);
      }

    } finally {
      setIsLoadingConversation(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!currentConvId) {
      // No specific conversation — auto-load latest (mood check allowed)
      const init = async () => {
        const res = await fetch(`/api/conversations?userId=${userId}`);
        if (res.ok) {
          const convs = await res.json();
          if (convs.length > 0) {
            setCurrentConvId(convs[0].id);
            loadConversation(convs[0].id, true);
            return;
          }
        }
        // No existing conversations — create one
        const createRes = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'New Chat', userId }),
        });
        const conv = await createRes.json();
        setCurrentConvId(conv.id);
        loadConversation(conv.id);
      };
      init();
    } else {
      // Explicit navigation to a specific conversation — never trigger mood
      loadConversation(currentConvId);
    }
  }, [conversationId, userId, currentConvId]);

  const handleDeleteMessage = async (messageId: string) => {
    if (!currentConvId) return;

    try {
      const res = await fetch(
        `/api/conversations/${currentConvId}/messages?messageId=${messageId}&userId=${userId}`,
        { method: 'DELETE' }
      );

      if (res.ok) {
        setMessages((prev: Message[]) => prev.filter((m: Message) => m.id !== messageId));
      }
    } catch (err) {
      console.error('Error deleting message:', err);
    }
  };


  const handleExport = () => {
    if (messages.length === 0) return;
    const lines = messages
      .filter((m: Message) => m.content.trim())
      .map((m: Message) => {
        const sender = m.role === 'user' ? (nickname || 'You') : (aiName || 'Lumi');
        const time = m.createdAt ? ` [${new Date(m.createdAt).toLocaleString()}]` : '';
        return `${sender}${time}:\n${m.content}`;
      });
    const text = `Chat Export — ${aiName || 'Lumi'}\n${'='.repeat(40)}\n\n${lines.join('\n\n')}`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-export-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="flex w-full h-full bg-white/40 dark:bg-[#13111c]/50 backdrop-blur-2xl relative overflow-hidden">

      {/* Main Chat Area (Center) */}
      <section className="flex-1 flex flex-col min-w-0 relative h-full">
        <VoiceVisualizer isListening={isListening} isSpeaking={isSpeaking} onStop={() => { stopListening(); cancelSpeech(); }} timeRemaining={timeRemaining ?? undefined} maxDuration={maxDuration} />

        <ChatHeader
          aiName={aiName}
          onOpenSidebar={onOpenSidebar}
          onExport={messages.length > 0 ? handleExport : undefined}
          onOpenChallenge={() => setChallengeOpen(true)}
          streak={streak}
        />

        {/* ... */}



        {/* Messages */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* ... */}

            {isLoadingConversation ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 pt-20">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-purple-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-purple-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-purple-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-sm text-neutral-400 dark:text-neutral-500">Loading conversation...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-neutral-400 dark:text-neutral-500 pt-20">
                <span className="text-3xl opacity-60">💬</span>
                <span className="text-sm">Start a new conversation...</span>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div key={index} id={msg.id ? `msg-${msg.id}` : undefined}>
                  <ChatBubble role={msg.role} content={msg.content} messageId={msg.id} createdAt={msg.createdAt} onDelete={handleDeleteMessage} profilePicture={profilePicture} nickname={nickname} isHighlighted={!!highlightId && msg.id === highlightId} />
                  {msg.id === 'mood-selector' && !moodchoose && (
                    <MoodSelector
                      onSelect={(mood) => {
                        setMoodchoose(true);
                        handleSendMessage(`My mood today: ${mood}`);
                      }}
                    />
                  )}
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="px-5 py-3 rounded-2xl bg-white/70 dark:bg-white/10 border border-purple-100/40 dark:border-purple-800/30">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} style={{ height: '1px' }} />
          </div>
        </div>

        {/* Input Area */}
        <div className="w-full border-t border-purple-100/30 dark:border-purple-800/15 bg-white/30 dark:bg-[#13111c]/40 backdrop-blur-2xl">
          <div className="max-w-3xl mx-auto">
            <ChatInput onSendMessage={handleSendMessage} isLoading={isStreaming} onStartVoice={startListening} />
          </div>
        </div>

      </section>

      {/* Daily Challenge Modal */}
      {
        challengeOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setChallengeOpen(false)}>
            <div className="bg-[#faf7f2] dark:bg-[#1e1e1e] rounded-3xl p-1 shadow-2xl max-w-sm w-full animate-scale-in" onClick={e => e.stopPropagation()}>
              <div className="relative">
                <DailyChallengeCard userId={userId} />
                <button
                  onClick={() => setChallengeOpen(false)}
                  title="Close daily challenge"
                  className="absolute top-2 right-2 p-1 bg-white/50 dark:bg-black/20 rounded-full text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Notifications/Modals */}
      {
        searchNotification && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 animate-fade-in">
            <div className="px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-medium shadow-lg shadow-purple-500/20 flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              {searchNotification}
            </div>
          </div>
        )
      }


    </div >
  );
}

