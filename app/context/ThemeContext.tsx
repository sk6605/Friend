'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

/**
 * 接口：主题上下文类型定义
 */
interface ThemeContextType {
  isDark: boolean; // 是否为深色模式
  toggle: () => void; // 切换主题的方法
}

const ThemeContext = createContext<ThemeContextType>({ isDark: false, toggle: () => { } });

/**
 * 组件：主题提供者 (ThemeProvider)
 * 作用：管理全局的深浅色模式，处理持久化存储及 HTML 根节点的 class 切换。
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  // 初始化：从本地存储读取用户偏好
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  // 核心逻辑：切换主题并处理过场动画
  const toggle = useCallback(() => {
    // 添加过渡类名，配合 CSS 实现平滑的颜色渐变
    document.documentElement.classList.add('theme-transitioning');

    setIsDark(prev => {
      const next = !prev;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });

    // 动画结束后移除过渡类，避免干扰正常样式交互
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transitioning');
    }, 600);
  }, []);

  return (
    <ThemeContext.Provider value={{ isDark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * 钩子：使用主题 (useTheme)
 */
export function useTheme() {
  return useContext(ThemeContext);
}
