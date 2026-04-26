'use client';

import { useEffect, useState } from 'react';

/**
 * 语音可视化组件属性 (VoiceVisualizerProps)
 * isListening: 是否处于用户说话/AI 监听状态
 * isSpeaking: 是否处于 AI 播放语音状态
 * onStop: 用户手动点击（如点击屏幕任何位置）触发的停止/退出回调
 * timeRemaining: 剩余时长（秒），用于倒计时戒指动画
 * maxDuration: 最大允许时长，默认 15s
 */
interface VoiceVisualizerProps {
  isListening: boolean;
  isSpeaking: boolean;
  onStop: () => void;
  timeRemaining?: number;
  maxDuration?: number;
}

/**
 * 组件：VoiceVisualizer (语音交互可视化全屏蒙层)
 * 作用：当进入语音模式时，提供一个高度沉浸且美观的界面。
 * 功能：
 * 1. 动态光圈：包含核心 Orb 以及三层随状态变化的 Ripple (涟漪) 动画。
 * 2. 倒计时圆环：展示剩余语音输入时间的 SVG 环形进度条。
 * 3. 沉浸式背景：支持深色模式适配的玻璃态 (Backdrop-blur) 全屏层。
 */
export default function VoiceVisualizer({ isListening, isSpeaking, onStop, timeRemaining, maxDuration = 15 }: VoiceVisualizerProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const isActive = isListening || isSpeaking;

  // 动画控制：入场与退场缓冲
  useEffect(() => {
    if (isActive) {
      setExiting(false);
      requestAnimationFrame(() => setVisible(true));
    } else if (visible) {
      // 执行退场动画，并延迟移除组件
      setExiting(true);
      setVisible(false);
      const timer = setTimeout(() => setExiting(false), 400);
      return () => clearTimeout(timer);
    }
  }, [isActive, visible]);

  if (!isActive && !exiting) return null;

  // 计算进度百分比 (0-1)，用于控制圆环 Dashoffset
  const progress = timeRemaining != null && maxDuration > 0
    ? timeRemaining / maxDuration
    : 1;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-2xl transition-all duration-400 ease-out
        ${visible && !exiting
          ? 'opacity-100'
          : 'opacity-0 pointer-events-none'
        }
      `}
      style={{
        background: 'linear-gradient(135deg, rgba(250,248,244,0.92) 0%, rgba(245,240,232,0.88) 100%)',
      }}
      onClick={onStop}
    >
      {/* 深色模式叠加层 */}
      <div className="absolute inset-0 bg-[#13111c]/0 dark:bg-[#13111c]/85 pointer-events-none" />

      <div className={`flex flex-col items-center gap-8 relative z-10 w-full px-8 transition-all duration-400 ease-out
        ${visible && !exiting
          ? 'scale-100 translate-y-0 opacity-100'
          : 'scale-90 translate-y-4 opacity-0'
        }
      `}>

        {/* 状态文案区域 */}
        <div className="text-center space-y-2">
          <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
            {isListening ? "Listening..." : "Speaking..."}
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {isListening ? "Try saying 'Hello' or asking a question" : "Tap anywhere to stop"}
          </p>
        </div>

        {/* 核心可视化：Orb + 每秒同步更新的 Timer 戒指 */}
        <div className="relative w-36 h-36 flex items-center justify-center cursor-pointer">
          
          {/* 进度圆环 (Timer Ring) */}
          {timeRemaining != null && (
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 144 144">
              <circle
                cx="72" cy="72" r="66"
                stroke="currentColor"
                className="text-purple-200/30 dark:text-purple-800/30"
                strokeWidth="3"
                fill="none"
              />
              <circle
                cx="72" cy="72" r="66"
                stroke="url(#timerGradient)"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 66}`}
                strokeDashoffset={`${2 * Math.PI * 66 * (1 - progress)}`}
                className="transition-[stroke-dashoffset] duration-1000 ease-linear"
              />
              <defs>
                <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#a855f7" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
              </defs>
            </svg>
          )}

          {/* 核心发光 Orb */}
          <div className={`w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shadow-[0_0_40px_rgba(168,85,247,0.4)] z-10 transition-transform duration-300 ${isSpeaking ? 'scale-110' : 'scale-100'}`} />

          {/* 涟漪背景动画 (Ripples)
              Listening 状态下使用 animate-ping 实现扩散
              Speaking 状态下使用 animate-pulse 实现呼吸效果
          */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`absolute w-24 h-24 rounded-full border-2 border-purple-500/30 ${isListening ? 'animate-ping' : isSpeaking ? 'animate-pulse' : ''}`} style={{ animationDuration: '2s' }} />
            <span className={`absolute w-28 h-28 rounded-full border-2 border-pink-500/20 ${isListening ? 'animate-ping' : isSpeaking ? 'animate-pulse' : ''}`} style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
            <span className={`absolute w-32 h-32 rounded-full border-2 border-purple-500/10 ${isListening ? 'animate-ping' : isSpeaking ? 'animate-pulse' : ''}`} style={{ animationDuration: '2s', animationDelay: '1s' }} />
          </div>
        </div>

        {/* 剩余秒数提示 */}
        {timeRemaining != null && (
          <span className="text-xs text-neutral-400 dark:text-neutral-500 tabular-nums">
            {timeRemaining}s remaining
          </span>
        )}

        {/* 取消/关闭按钮 */}
        <button
          onClick={(e) => { e.stopPropagation(); onStop(); }}
          className="px-8 py-2.5 rounded-full bg-white/60 dark:bg-white/10 backdrop-blur-xl text-neutral-600 dark:text-neutral-300 hover:bg-white/80 dark:hover:bg-white/20 transition-all duration-200 text-sm font-medium border border-white/50 dark:border-white/10 shadow-lg shadow-purple-500/5"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
