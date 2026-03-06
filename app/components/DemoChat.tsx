'use client';

import { useState, useRef, useEffect } from 'react';
import { getAllPersonas, PersonaDefinition } from '@/app/lib/ai/personaPrompts';

const MAX_USER_MESSAGES = 4;

type Lang = 'zh' | 'en';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface DemoChatProps {
  onClose: () => void;
  onSignUp: () => void;
}

// ─── i18n strings ─────────────────────────────────────────────────────────────
const t = {
  zh: {
    langTitle: '选择语言',
    langSub: 'AI 将用你选择的语言来回复你',
    langZh: '中文',
    langEn: 'English',
    personaTitle: '选择你的 AI 朋友风格',
    personaSub: '先试试，再决定要不要爱上 TA',
    demoMode: '体验模式',
    remaining: (n: number) => `剩余 ${n} 条`,
    placeholder: '说点什么…',
    limitTitle: '哎呀，我们聊得真开心呢 ✨',
    limitBody: (
      <>
        你已经用完了体验次数，但我们的对话才刚刚开始！<br />
        注册账号，解锁<span className="text-purple-500 font-medium">无限次对话</span>、记忆功能和更多专属体验 —— 毕竟，好朋友值得用心经营 🌟
      </>
    ),
    limitCta: '马上注册，继续聊 🚀',
    limitSkip: '也许下次吧',
    errorMsg: '哎呀，好像出了点小问题 😅 再试一次？',
    greetings: {
      default: '嘿！我是你的 AI 朋友 😊 有什么想聊的？',
      gentle: '嗨～ 我在这里陪着你呢 🌸 有什么想说的，慢慢来。',
      witty: '哟！你来了 😏 准备好被我逗乐了吗？说说你想聊啥 🔥',
      mentor: '欢迎！💡 有什么问题或目标想一起探讨？',
      chill: '嘿 😎 随便聊，不用客气。',
    },
    personaNames: {
      default: '平衡好友',
      gentle: '温柔伴侣',
      witty: '段子手',
      mentor: '智慧导师',
      chill: '佛系搭子',
    },
    personaDescs: {
      default: '温暖、支持你，还带点自然幽默感——经典款 AI 朋友。',
      gentle: '像贴心大姐姐——轻声细语，耐心满满，永远接住你。',
      witty: '你最搞笑的朋友——反应快、爱整活，从不无聊。',
      mentor: '用心的教练——问对问题，推动你成长。',
      chill: '零压力、满满氛围感——像慵懒周日下午的聊天。',
    },
    personaQuotes: {
      default: '"嘿！最近怎么样？都跟我说说 😄✨"',
      gentle: '"慢慢来，我一直在这里陪着你 🌸💕 不用急。"',
      witty: '"你居然来了 😂 好，坐下，让我好好教你什么叫快乐 🔥"',
      mentor: '"有意思。那你觉得真正阻碍你的是什么？🤔💡"',
      chill: '"哟 😎 随便，想聊啥都行。"',
    },
  },
  en: {
    langTitle: 'Choose Language',
    langSub: 'Your AI friend will reply in the language you pick',
    langZh: '中文',
    langEn: 'English',
    personaTitle: 'Choose Your AI Style',
    personaSub: 'Try before you decide to fall for it',
    demoMode: 'Demo Mode',
    remaining: (n: number) => `${n} left`,
    placeholder: 'Say something…',
    limitTitle: 'Wow, we were really vibing there ✨',
    limitBody: (
      <>
        You&apos;ve used up your trial messages — but our conversation is just getting started!<br />
        Sign up to unlock <span className="text-purple-500 font-medium">unlimited chats</span>, memory, and a whole lot more 🌟
      </>
    ),
    limitCta: 'Sign up & keep chatting 🚀',
    limitSkip: 'Maybe later',
    errorMsg: 'Oops, something went wrong 😅 Try again?',
    greetings: {
      default: 'Hey! I\'m your AI friend 😊 What\'s on your mind?',
      gentle: 'Hi~ I\'m right here with you 🌸 Take your time.',
      witty: 'Heyyy, you made it 😏 Ready to have some fun? Tell me everything 🔥',
      mentor: 'Welcome! 💡 What\'s on your mind — any goals or questions to explore?',
      chill: 'Yo 😎 What\'s up, no pressure.',
    },
    personaNames: {
      default: 'Balanced Friend',
      gentle: 'Gentle Soul',
      witty: 'Witty Buddy',
      mentor: 'Wise Mentor',
      chill: 'Chill Companion',
    },
    personaDescs: {
      default: 'Warm, supportive, and naturally funny — the classic Friend AI.',
      gentle: 'Like a caring big sister — soft-spoken, nurturing, always patient.',
      witty: 'Your funniest friend — quick-witted, playful, never boring.',
      mentor: 'A thoughtful coach — asks the right questions, pushes you to grow.',
      chill: 'Zero pressure, maximum vibes — like chatting on a lazy Sunday.',
    },
    personaQuotes: {
      default: '"Hey! How\'s your day going? Tell me everything 😄✨"',
      gentle: '"Take your time, I\'m right here with you 🌸💕 No rush at all."',
      witty: '"Oh you did NOT just say that 😂 Okay sit down, let me educate you 🔥"',
      mentor: '"Interesting. What do you think is really holding you back here? 🤔💡"',
      chill: '"Yo that\'s cool 😎 honestly no stress, everything works out ✌️"',
    },
  },
} as const;

// ─── Language Selection Screen ─────────────────────────────────────────────────
function LanguageSelect({
  onSelect,
  onClose,
}: {
  onSelect: (lang: Lang) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/10 transition-all"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <div className="w-8" />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 pb-12 gap-8">
        {/* Globe icon */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-violet-100 dark:from-purple-900/40 dark:to-violet-900/40 flex items-center justify-center">
          <span className="text-3xl">🌐</span>
        </div>

        <div className="text-center">
          <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-100">
            选择语言 / Choose Language
          </h2>
          <p className="text-sm text-neutral-400 mt-2">
            AI 将用你选择的语言来回复你<br />
            <span className="text-xs">AI will reply in the language you pick</span>
          </p>
        </div>

        {/* Language buttons */}
        <div className="w-full space-y-3">
          <button
            onClick={() => onSelect('zh')}
            className="
              w-full py-5 rounded-2xl
              bg-white dark:bg-white/5
              border-2 border-neutral-100 dark:border-white/10
              hover:border-purple-300 dark:hover:border-purple-500/50
              hover:bg-purple-50/50 dark:hover:bg-purple-900/20
              active:scale-[0.98]
              transition-all duration-200
              group
            "
          >
            <div className="flex items-center justify-center gap-3">
              <span className="text-2xl">🇨🇳</span>
              <div className="text-left">
                <p className="text-base font-bold text-neutral-800 dark:text-neutral-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  中文
                </p>
                <p className="text-xs text-neutral-400">Chinese</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => onSelect('en')}
            className="
              w-full py-5 rounded-2xl
              bg-white dark:bg-white/5
              border-2 border-neutral-100 dark:border-white/10
              hover:border-purple-300 dark:hover:border-purple-500/50
              hover:bg-purple-50/50 dark:hover:bg-purple-900/20
              active:scale-[0.98]
              transition-all duration-200
              group
            "
          >
            <div className="flex items-center justify-center gap-3">
              <span className="text-2xl">🇬🇧</span>
              <div className="text-left">
                <p className="text-base font-bold text-neutral-800 dark:text-neutral-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  English
                </p>
                <p className="text-xs text-neutral-400">英文</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Persona Selection Screen ─────────────────────────────────────────────────
function PersonaSelect({
  lang,
  onSelect,
  onBack,
}: {
  lang: Lang;
  onSelect: (persona: PersonaDefinition) => void;
  onBack: () => void;
}) {
  const personas = getAllPersonas();
  const strings = t[lang];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <button
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-center rounded-full text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/10 transition-all"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="flex-1 text-center px-4">
          <h2 className="text-base font-semibold text-neutral-800 dark:text-neutral-100">
            {strings.personaTitle}
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">{strings.personaSub}</p>
        </div>
        <div className="w-8" />
      </div>

      {/* Persona cards */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
        {personas.map((p) => (
          <button
            key={p.key}
            onClick={() => onSelect(p)}
            className="
              w-full text-left rounded-2xl p-4
              bg-white dark:bg-white/5
              border border-neutral-100 dark:border-white/10
              hover:border-purple-300 dark:hover:border-purple-500/50
              hover:bg-purple-50/50 dark:hover:bg-purple-900/20
              active:scale-[0.98]
              transition-all duration-200
              group
            "
          >
            <div className="flex items-start gap-3">
              <span className="text-3xl leading-none mt-0.5">{p.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-neutral-800 dark:text-neutral-100">
                    {strings.personaNames[p.key as keyof typeof strings.personaNames] ?? p.name}
                  </span>
                  <span className="text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {strings.personaDescs[p.key as keyof typeof strings.personaDescs] ?? p.description}
                </p>
                <p className="text-xs text-purple-500 dark:text-purple-400 mt-2 italic">
                  {strings.personaQuotes[p.key as keyof typeof strings.personaQuotes] ?? p.previewQuote}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Limit Reached Modal ──────────────────────────────────────────────────────
function LimitModal({
  lang,
  onSignUp,
  onClose,
}: {
  lang: Lang;
  onSignUp: () => void;
  onClose: () => void;
}) {
  const strings = t[lang];

  return (
    <div className="absolute inset-0 z-20 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm rounded-[inherit]">
      <div className="
        w-full max-w-sm
        bg-white dark:bg-[#1a1730]
        rounded-3xl
        border border-neutral-200/80 dark:border-purple-800/30
        shadow-[0_32px_80px_rgba(0,0,0,0.2)]
        overflow-hidden
      ">
        <div className="h-1.5 w-full bg-gradient-to-r from-purple-500 via-violet-500 to-pink-500" />

        <div className="p-7">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-100 to-violet-100 dark:from-purple-900/40 dark:to-violet-900/40 flex items-center justify-center">
            <span className="text-2xl">💜</span>
          </div>

          <h3 className="text-center text-lg font-bold text-neutral-800 dark:text-neutral-100 leading-snug">
            {strings.limitTitle}
          </h3>
          <p className="text-center text-sm text-neutral-500 dark:text-neutral-400 mt-3 leading-relaxed">
            {strings.limitBody}
          </p>

          <button
            onClick={onSignUp}
            className="
              mt-6 w-full py-3.5 rounded-2xl
              text-sm font-semibold text-white
              bg-gradient-to-r from-purple-600 to-violet-600
              hover:from-purple-500 hover:to-violet-500
              active:scale-[0.98]
              shadow-lg shadow-purple-500/25
              transition-all duration-200
            "
          >
            {strings.limitCta}
          </button>

          <button
            onClick={onClose}
            className="mt-3 w-full py-2.5 rounded-2xl text-sm text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
          >
            {strings.limitSkip}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Chat Screen ──────────────────────────────────────────────────────────────
function ChatScreen({
  lang,
  persona,
  onBack,
  onSignUp,
}: {
  lang: Lang;
  persona: PersonaDefinition;
  onBack: () => void;
  onSignUp: () => void;
}) {
  const strings = t[lang];
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [userMsgCount, setUserMsgCount] = useState(0);
  const [showLimit, setShowLimit] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const greeting = strings.greetings[persona.key as keyof typeof strings.greetings]
    ?? strings.greetings.default;

  const personaDisplayName = strings.personaNames[persona.key as keyof typeof strings.personaNames]
    ?? persona.name;

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    if (userMsgCount >= MAX_USER_MESSAGES) {
      setShowLimit(true);
      return;
    }

    const newCount = userMsgCount + 1;
    setUserMsgCount(newCount);
    setInput('');

    const newMessages: Message[] = [
      ...messages,
      { role: 'user', content: text },
    ];
    setMessages(newMessages);
    setIsStreaming(true);

    // Streaming placeholder
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/chat/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          persona: persona.key,
          language: lang,
        }),
      });

      if (!res.ok || !res.body) throw new Error('Stream failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: accumulated };
          return updated;
        });
      }

      if (newCount >= MAX_USER_MESSAGES) {
        setTimeout(() => setShowLimit(true), 800);
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: strings.errorMsg,
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const remaining = MAX_USER_MESSAGES - userMsgCount;

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-neutral-100 dark:border-white/5">
        <button
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-center rounded-full text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/10 transition-all"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="flex items-center gap-2 flex-1">
          <span className="text-xl">{persona.emoji}</span>
          <div>
            <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 leading-none">
              {personaDisplayName}
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">{strings.demoMode}</p>
          </div>
        </div>
        {/* Message counter */}
        <div className={`
          px-2.5 py-1 rounded-full text-xs font-medium transition-colors
          ${remaining <= 3
            ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-500'
            : 'bg-neutral-100 dark:bg-white/10 text-neutral-400'}
        `}>
          {strings.remaining(remaining)}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Greeting bubble */}
        <div className="flex gap-2.5 items-end">
          <span className="text-lg leading-none mb-1">{persona.emoji}</span>
          <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-bl-sm bg-neutral-100 dark:bg-white/10 text-sm text-neutral-700 dark:text-neutral-200 leading-relaxed">
            {greeting}
          </div>
        </div>

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2.5 items-end ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            {msg.role === 'assistant' && (
              <span className="text-lg leading-none mb-1">{persona.emoji}</span>
            )}
            <div
              className={`
                max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed
                ${msg.role === 'user'
                  ? 'bg-purple-600 text-white rounded-br-sm'
                  : 'bg-neutral-100 dark:bg-white/10 text-neutral-700 dark:text-neutral-200 rounded-bl-sm'}
              `}
            >
              {msg.content || (
                <span className="flex gap-1 items-center h-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-neutral-100 dark:border-white/5">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={strings.placeholder}
            rows={1}
            disabled={isStreaming || userMsgCount >= MAX_USER_MESSAGES}
            className="
              flex-1 resize-none px-4 py-3 rounded-2xl text-sm
              bg-neutral-50 dark:bg-white/5
              border border-neutral-200 dark:border-white/10
              text-neutral-800 dark:text-neutral-100
              placeholder-neutral-400 dark:placeholder-neutral-500
              outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 dark:focus:ring-purple-900/30
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all max-h-32
            "
            style={{ lineHeight: '1.5' }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming || userMsgCount >= MAX_USER_MESSAGES}
            className="
              w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-2xl
              bg-purple-600 hover:bg-purple-500
              disabled:opacity-40 disabled:cursor-not-allowed
              active:scale-95
              transition-all
            "
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Limit Modal */}
      {showLimit && (
        <LimitModal
          lang={lang}
          onSignUp={() => {
            setShowLimit(false);
            onSignUp();
          }}
          onClose={() => setShowLimit(false)}
        />
      )}
    </div>
  );
}

// ─── Main DemoChat Component ──────────────────────────────────────────────────
type Step = 'language' | 'persona' | 'chat';

export default function DemoChat({ onClose, onSignUp }: DemoChatProps) {
  const [step, setStep] = useState<Step>('language');
  const [lang, setLang] = useState<Lang>('zh');
  const [selectedPersona, setSelectedPersona] = useState<PersonaDefinition | null>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="
          w-full max-w-md h-[85vh] max-h-[700px]
          bg-white dark:bg-[#13111f]
          rounded-3xl
          border border-neutral-200/80 dark:border-purple-900/30
          shadow-[0_40px_120px_rgba(0,0,0,0.25)]
          overflow-hidden
          flex flex-col
          relative
        "
      >
        {step === 'language' && (
          <LanguageSelect
            onSelect={(l) => {
              setLang(l);
              setStep('persona');
            }}
            onClose={onClose}
          />
        )}

        {step === 'persona' && (
          <PersonaSelect
            lang={lang}
            onSelect={(p) => {
              setSelectedPersona(p);
              setStep('chat');
            }}
            onBack={() => setStep('language')}
          />
        )}

        {step === 'chat' && selectedPersona && (
          <ChatScreen
            lang={lang}
            persona={selectedPersona}
            onBack={() => setStep('persona')}
            onSignUp={onSignUp}
          />
        )}
      </div>
    </div>
  );
}
