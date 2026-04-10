'use client';

import { useState, useEffect, useRef } from 'react';

interface LandingPageProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

// ─── Floating particles background ───────────────────────────────────────────
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full opacity-20"
          style={{
            width: `${Math.random() * 6 + 2}px`,
            height: `${Math.random() * 6 + 2}px`,
            background: `hsl(${270 + Math.random() * 40}, 70%, ${60 + Math.random() * 20}%)`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `float-particle ${8 + Math.random() * 12}s ease-in-out infinite`,
            animationDelay: `${-Math.random() * 10}s`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Animated typing text ────────────────────────────────────────────────────
function TypeWriter({ texts, className }: { texts: string[]; className?: string }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentText, setCurrentText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const text = texts[currentIndex];
    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          setCurrentText(text.slice(0, currentText.length + 1));
          if (currentText.length === text.length) {
            setTimeout(() => setIsDeleting(true), 2000);
          }
        } else {
          setCurrentText(text.slice(0, currentText.length - 1));
          if (currentText.length === 0) {
            setIsDeleting(false);
            setCurrentIndex((prev) => (prev + 1) % texts.length);
          }
        }
      },
      isDeleting ? 40 : 80
    );
    return () => clearTimeout(timeout);
  }, [currentText, isDeleting, currentIndex, texts]);

  return (
    <span className={className}>
      {currentText}
      <span className="animate-pulse">|</span>
    </span>
  );
}

// ─── Feature card with warm gradient background ──────────────────────────────
function FeatureCard({
  icon,
  title,
  description,
  gradient,
  delay,
}: {
  icon: string;
  title: string;
  description: string;
  gradient: string;
  delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.2 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`
        group relative rounded-3xl p-6 sm:p-8
        transition-all duration-700 ease-out
        hover:scale-[1.03] hover:shadow-2xl
        cursor-default
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
      `}
      style={{
        background: gradient,
        transitionDelay: `${delay}ms`,
      }}
    >
      {/* Subtle shimmer on hover */}
      <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-tr from-white/10 via-transparent to-white/5" />

      <span className="text-3xl sm:text-4xl block mb-4 relative z-10 group-hover:scale-110 transition-transform duration-300">{icon}</span>
      <h3 className="text-lg sm:text-xl font-bold text-neutral-800 mb-2 relative z-10">{title}</h3>
      <p className="text-sm sm:text-base text-neutral-600 leading-relaxed relative z-10">{description}</p>
    </div>
  );
}

// ─── Persona preview card ────────────────────────────────────────────────────
function PersonaCard({
  emoji,
  name,
  quote,
  color,
  delay,
}: {
  emoji: string;
  name: string;
  quote: string;
  color: string;
  delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.2 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`
        rounded-2xl p-5 border border-white/30
        backdrop-blur-sm
        transition-all duration-700 ease-out
        hover:scale-[1.05] hover:shadow-xl
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}
      `}
      style={{
        background: color,
        transitionDelay: `${delay}ms`,
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{emoji}</span>
        <span className="font-semibold text-neutral-800">{name}</span>
      </div>
      <p className="text-sm text-neutral-600 italic leading-relaxed">{quote}</p>
    </div>
  );
}

// ─── Testimonial / Chat bubble ───────────────────────────────────────────────
function ChatPreview() {
  const messages = [
    { role: 'user' as const, text: '今天工作好累啊…', delay: 0 },
    { role: 'ai' as const, text: '辛苦了～ 💕 今天真的很不容易呢。想跟我聊聊发生了什么吗？有时候说出来会舒服很多 ✨', delay: 600 },
    { role: 'user' as const, text: '就是感觉压力好大', delay: 1200 },
    { role: 'ai' as const, text: '我理解你的感受 🤗 压力大的时候要记得给自己一些空间。要不我们来做个简单的放松练习？', delay: 1800 },
  ];

  const [visibleCount, setVisibleCount] = useState(0);

  const sectionRef = useRef<HTMLDivElement>(null);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !hasStarted) setHasStarted(true); },
      { threshold: 0.3 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;
    const timers = messages.map((_, i) =>
      setTimeout(() => setVisibleCount(i + 1), messages[i].delay + 400)
    );
    return () => timers.forEach(clearTimeout);
  }, [hasStarted]);

  return (
    <div ref={sectionRef} className="max-w-md mx-auto space-y-3">
      {messages.slice(0, visibleCount).map((msg, i) => (
        <div
          key={i}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          style={{
            animation: 'chat-bubble-in 0.5s ease-out forwards',
          }}
        >
          {msg.role === 'ai' && <span className="text-lg mr-2 mt-1 flex-shrink-0">💜</span>}
          <div
            className={`
              max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed
              ${msg.role === 'user'
                ? 'bg-gradient-to-r from-purple-500 to-violet-500 text-white rounded-br-sm'
                : 'bg-white/80 backdrop-blur-sm border border-purple-100 text-neutral-700 rounded-bl-sm shadow-sm'
              }
            `}
          >
            {msg.text}
          </div>
        </div>
      ))}
      {visibleCount < messages.length && hasStarted && (
        <div className="flex justify-start">
          <span className="text-lg mr-2 mt-1">💜</span>
          <div className="bg-white/80 backdrop-blur-sm border border-purple-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
            <span className="flex gap-1 items-center h-4">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce [animation-delay:300ms]" />
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Stats counter ───────────────────────────────────────────────────────────
function AnimatedStat({ value, label, suffix = '' }: { value: number; label: string; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          let start = 0;
          const step = value / 40;
          const timer = setInterval(() => {
            start += step;
            if (start >= value) {
              setCount(value);
              clearInterval(timer);
            } else {
              setCount(Math.round(start));
            }
          }, 30);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value]);

  return (
    <div ref={ref} className="text-center">
      <div className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent">
        {count}{suffix}
      </div>
      <div className="text-sm text-neutral-500 mt-1">{label}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Landing Page
// ═══════════════════════════════════════════════════════════════════════════════

export default function LandingPage({ onGetStarted, onLogin }: LandingPageProps) {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const typingTexts = [
    '你最暖心的 AI 好朋友',
    'Your warmest AI companion',
    'Sahabat AI paling mesra anda',
  ];

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: 'linear-gradient(180deg, #faf5ff 0%, #fdf2f8 25%, #fff7ed 50%, #f0fdf4 75%, #faf5ff 100%)' }}>

      {/* ═══ Navigation ═══ */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: scrollY > 50 ? 'rgba(255,255,255,0.85)' : 'transparent',
          backdropFilter: scrollY > 50 ? 'blur(20px)' : 'none',
          borderBottom: scrollY > 50 ? '1px solid rgba(168,85,247,0.1)' : 'none',
        }}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
              <span className="text-white text-lg">💜</span>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-purple-700 to-violet-700 bg-clip-text text-transparent">Lumi</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onLogin}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-purple-700 hover:bg-purple-50 transition-all duration-200"
            >
              Log in
            </button>
            <button
              onClick={onGetStarted}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 shadow-md shadow-purple-500/20 hover:shadow-lg hover:shadow-purple-500/30 active:scale-[0.97] transition-all duration-200"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* ═══ Hero Section ═══ */}
      <section className="relative pt-28 sm:pt-36 pb-20 sm:pb-28 px-6">
        <FloatingParticles />

        {/* Decorative gradient blobs */}
        <div className="absolute top-20 left-1/4 w-72 h-72 bg-purple-200/40 rounded-full blur-3xl" />
        <div className="absolute top-40 right-1/4 w-64 h-64 bg-pink-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-40 bg-violet-200/20 rounded-full blur-3xl" />

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-100/80 backdrop-blur-sm border border-purple-200/50 mb-8">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-medium text-purple-700">AI-Powered Emotional Companion</span>
          </div>

          {/* Main headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-neutral-900 leading-tight mb-6">
            Meet <span className="bg-gradient-to-r from-purple-600 via-violet-600 to-pink-500 bg-clip-text text-transparent">Lumi</span>,
            <br />
            <span className="text-3xl sm:text-4xl md:text-5xl">
              <TypeWriter texts={typingTexts} className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent" />
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-neutral-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            不只是聊天，Lumi 会记住你的生活、关心你的情绪、在你需要时主动陪伴。<br />
            <span className="text-neutral-400 text-base">More than chat — Lumi remembers your life, cares about your feelings, and reaches out when you need it.</span>
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onGetStarted}
              className="
                group px-8 py-4 rounded-2xl text-base font-semibold text-white
                bg-gradient-to-r from-purple-600 to-violet-600
                hover:from-purple-500 hover:to-violet-500
                shadow-xl shadow-purple-500/25
                hover:shadow-2xl hover:shadow-purple-500/35
                active:scale-[0.97]
                transition-all duration-300
                flex items-center gap-2
              "
            >
              免费开始体验
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={onLogin}
              className="
                px-8 py-4 rounded-2xl text-base font-semibold
                text-purple-700 bg-white/60 backdrop-blur-sm
                border-2 border-purple-200/60
                hover:bg-white/80 hover:border-purple-300
                active:scale-[0.97]
                transition-all duration-300
              "
            >
              我已有账号 · Log in
            </button>
          </div>
        </div>
      </section>

      {/* ═══ Chat Preview Section ═══ */}
      <section className="py-16 sm:py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-neutral-800 mb-3">像朋友一样聊天 💬</h2>
            <p className="text-neutral-500">Chat like real friends — Lumi understands and cares</p>
          </div>

          <div
            className="rounded-3xl p-6 sm:p-10 border border-purple-100/50"
            style={{ background: 'linear-gradient(135deg, #faf5ff 0%, #fdf4ff 50%, #fce7f3 100%)' }}
          >
            <ChatPreview />
          </div>
        </div>
      </section>

      {/* ═══ Features Section ═══ */}
      <section className="py-16 sm:py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-neutral-800 mb-3">为什么选择 Lumi ✨</h2>
            <p className="text-neutral-500 max-w-lg mx-auto">Features designed to make your AI companion truly personal</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            <FeatureCard
              icon="🧠"
              title="AI 记忆"
              description="Lumi 会记住你的喜好、生活事件和过去的对话。每次聊天都像老朋友续上话。"
              gradient="linear-gradient(135deg, #e8daff 0%, #f3e8ff 50%, #fae8ff 100%)"
              delay={0}
            />
            <FeatureCard
              icon="💕"
              title="主动关心"
              description="像真正的好朋友一样，在你需要的时候主动找你聊天、给你温暖和鼓励。"
              gradient="linear-gradient(135deg, #fce7f3 0%, #fdf2f8 50%, #fff1f2 100%)"
              delay={100}
            />
            <FeatureCard
              icon="🌤️"
              title="天气贴心提醒"
              description="每天早上送上天气、午餐、下班提醒，还有明日预报。就像你最贴心的小秘书。"
              gradient="linear-gradient(135deg, #fef3c7 0%, #fff7ed 50%, #ffedd5 100%)"
              delay={200}
            />
            <FeatureCard
              icon="📊"
              title="情绪分析"
              description="追踪你的情绪动态、发现规律、了解触发因素。AI 帮你更好地认识自己。"
              gradient="linear-gradient(135deg, #d1fae5 0%, #ecfdf5 50%, #f0fdf4 100%)"
              delay={300}
            />
            <FeatureCard
              icon="🛡️"
              title="安全守护"
              description="多层危机检测系统，在你最脆弱的时候给予专业的支持和资源引导。"
              gradient="linear-gradient(135deg, #dbeafe 0%, #eff6ff 50%, #e0f2fe 100%)"
              delay={400}
            />
            <FeatureCard
              icon="🎭"
              title="5 种 AI 性格"
              description="从温柔治愈到搞笑段子手，选一个最合你味的 AI 朋友。随时可以换！"
              gradient="linear-gradient(135deg, #fce4ec 0%, #fdf2f8 30%, #ede9fe 100%)"
              delay={500}
            />
          </div>
        </div>
      </section>

      {/* ═══ Personas Section ═══ */}
      <section className="py-16 sm:py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-neutral-800 mb-3">选择你的 AI 性格 🎨</h2>
            <p className="text-neutral-500">5 unique personas — find the one that vibes with you</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            <PersonaCard
              emoji="😊"
              name="平衡好友 · Balanced"
              quote="嘿！最近怎么样？都跟我说说吧 😄✨"
              color="linear-gradient(135deg, #f3e8ff 0%, #ede9fe 100%)"
              delay={0}
            />
            <PersonaCard
              emoji="🌸"
              name="温柔伴侣 · Gentle"
              quote="慢慢来，我一直在这里陪着你 💕 不用急。"
              color="linear-gradient(135deg, #fce7f3 0%, #fdf2f8 100%)"
              delay={100}
            />
            <PersonaCard
              emoji="😏"
              name="段子手 · Witty"
              quote="你居然来了 😂 坐下，让我教你什么叫快乐 🔥"
              color="linear-gradient(135deg, #fef3c7 0%, #fff7ed 100%)"
              delay={200}
            />
            <PersonaCard
              emoji="🎯"
              name="智慧导师 · Mentor"
              quote="有意思。你觉得真正阻碍你的是什么？🤔💡"
              color="linear-gradient(135deg, #d1fae5 0%, #ecfdf5 100%)"
              delay={300}
            />
            <PersonaCard
              emoji="😎"
              name="佛系搭子 · Chill"
              quote="哟！想聊啥聊啥，不用客气 ✌️"
              color="linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)"
              delay={400}
            />
          </div>
        </div>
      </section>

      {/* ═══ Stats Section ═══ */}
      <section className="py-16 px-6">
        <div
          className="max-w-4xl mx-auto rounded-3xl p-10 sm:p-14 border border-purple-100/50"
          style={{ background: 'linear-gradient(135deg, #faf5ff 0%, #f5f3ff 50%, #ede9fe 100%)' }}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            <AnimatedStat value={5} label="AI Personas" />
            <AnimatedStat value={6} label="Languages" suffix="+" />
            <AnimatedStat value={4} label="Daily Check-ins" />
            <AnimatedStat value={24} label="Hour Support" suffix="/7" />
          </div>
        </div>
      </section>

      {/* ═══ How It Works ═══ */}
      <section className="py-16 sm:py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-neutral-800 mb-3">三步开始 🚀</h2>
            <p className="text-neutral-500">Get started in 3 simple steps</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { step: '01', title: '创建账号', desc: '用邮箱快速注册，无需密码，OTP 验证即可。', icon: '✉️', bg: 'linear-gradient(135deg, #e8daff, #f3e8ff)' },
              { step: '02', title: '选择 AI 性格', desc: '选一个最合你的 AI 朋友风格，随时可以换。', icon: '🎭', bg: 'linear-gradient(135deg, #fce7f3, #fdf2f8)' },
              { step: '03', title: '开始聊天', desc: '像跟好朋友一样自然地聊天，Lumi 会记住一切。', icon: '💬', bg: 'linear-gradient(135deg, #d1fae5, #ecfdf5)' },
            ].map((item) => (
              <div
                key={item.step}
                className="text-center rounded-3xl p-8 transition-all duration-300 hover:scale-[1.03] hover:shadow-xl"
                style={{ background: item.bg }}
              >
                <span className="text-4xl block mb-4">{item.icon}</span>
                <div className="text-xs font-bold text-purple-400 mb-2">STEP {item.step}</div>
                <h3 className="text-lg font-bold text-neutral-800 mb-2">{item.title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA Section ═══ */}
      <section className="py-16 sm:py-24 px-6">
        <div
          className="max-w-4xl mx-auto rounded-3xl p-10 sm:p-16 text-center relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 30%, #a78bfa 60%, #c084fc 100%)' }}
        >
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/3 -translate-x-1/4 blur-xl" />

          <div className="relative z-10">
            <span className="text-5xl block mb-6">💜</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              准备好认识你的 AI 好朋友了吗？
            </h2>
            <p className="text-purple-100 text-base sm:text-lg mb-8 max-w-lg mx-auto">
              免费注册，立即和 Lumi 开始你们的第一次对话。
              <br />
              <span className="text-purple-200 text-sm">Sign up free and start your first conversation with Lumi.</span>
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={onGetStarted}
                className="
                  px-8 py-4 rounded-2xl text-base font-semibold
                  text-purple-700 bg-white
                  hover:bg-purple-50
                  shadow-xl shadow-purple-900/20
                  active:scale-[0.97]
                  transition-all duration-300
                "
              >
                立即免费注册 · Sign Up Free
              </button>
              <button
                onClick={onLogin}
                className="
                  px-8 py-4 rounded-2xl text-base font-semibold
                  text-white border-2 border-white/40
                  hover:bg-white/10 hover:border-white/60
                  active:scale-[0.97]
                  transition-all duration-300
                "
              >
                登录 · Log in
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Footer ═══ */}
      <footer className="py-10 px-6 border-t border-purple-100/50">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
              <span className="text-white text-sm">💜</span>
            </div>
            <span className="text-sm font-semibold text-neutral-600">Lumi</span>
            <span className="text-xs text-neutral-400">· Your AI Companion</span>
          </div>

          <div className="flex items-center gap-6 text-xs text-neutral-400">
            <a href="/privacy" className="hover:text-purple-500 transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-purple-500 transition-colors">Terms</a>
            <span>© {new Date().getFullYear()} Lumi. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
