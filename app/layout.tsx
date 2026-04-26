import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ConversationProvider } from "./context/ConversationContext";
import { ThemeProvider } from "./context/ThemeContext";
import ErrorBoundary from "./components/ErrorBoundary";
import OneSignalInit from "./components/OneSignalInit";

// 字体配置：渲染更现代的 UI
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * 站点元数据配置 (Metadata)
 * 用于 SEO 优化以及 PWA (Progressive Web App) 的桌面端/移动端适配。
 */
export const metadata: Metadata = {
  title: "Lumi",
  description: "Your personal AI companion",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Lumi",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

/**
 * 视口配置 (Viewport)
 * 关键点：viewport-fit=cover 确保在带刘海屏的移动设备上全屏显示。
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#7c3aed",
};

/**
 * 组件：RootLayout (根布局)
 * 作用：定义所有页面的基础 HTML 结构，并挂载全局 Context Provider。
 * 
 * 层级设计：
 * 1. OneSignalInit: 处理移动端/Web 推送通知初始化。
 * 2. ErrorBoundary: 捕获并隔离渲染期间的代码错误，防止整站白屏。
 * 3. ThemeProvider: 管理全局明亮/暗色模式切换。
 * 4. ConversationProvider: 管理对话列表、同步历史记录等全局业务逻辑。
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* API 初始化组件 */}
        <OneSignalInit />
        
        {/* 全局异常捕捉 */}
        <ErrorBoundary>
          {/* 样式主题上下文 */}
          <ThemeProvider>
            {/* 业务逻辑（对话）上下文 */}
            <ConversationProvider>
              {children}
            </ConversationProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}

