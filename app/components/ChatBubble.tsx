'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// 定义文件附件的挂载对象特征
interface FileAttachment {
  name: string;
  url: string; // Vercel Blob URL 返回的外链
  size: number;
  type: string; // MIME TYPE 用来匹配颜色和图标
}

interface Props {
  role: 'user' | 'assistant';
  content: string;
  messageId?: string; // 允许追踪和删除气泡
  createdAt?: string; // 精准的时间戳定位
  onDelete?: (messageId: string) => void;
  profilePicture?: string | null;
  nickname?: string;
  isHighlighted?: boolean; // 用于搜索到的历史记录高亮大闪光
  fileAttachments?: FileAttachment[];
}

/**
 * 助手工具：将冰冷的 ISO 机器时间转换成自然人体时间表述（比如：Yesterday 15:30）
 */
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

/**
 * 助手工具：人性化文件容量体积标识
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 助手工具：文件图标路由器。通过读取截断扩展名匹配华丽的背景底色圈和 Emoji 头像。
 */
function getFileIcon(type: string, name: string): { icon: string; color: string } {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (type.startsWith('image/')) return { icon: '🖼️', color: 'bg-pink-100 dark:bg-pink-900/30' };
  if (['pdf'].includes(ext) || type === 'application/pdf') return { icon: '📄', color: 'bg-red-100 dark:bg-red-900/30' };
  if (['doc', 'docx'].includes(ext)) return { icon: '📝', color: 'bg-blue-100 dark:bg-blue-900/30' };
  if (['ppt', 'pptx'].includes(ext)) return { icon: '📊', color: 'bg-orange-100 dark:bg-orange-900/30' };
  if (['xls', 'xlsx', 'csv'].includes(ext)) return { icon: '📈', color: 'bg-green-100 dark:bg-green-900/30' };
  if (['txt', 'md', 'json'].includes(ext)) return { icon: '📃', color: 'bg-neutral-100 dark:bg-neutral-800' };
  return { icon: '📎', color: 'bg-neutral-100 dark:bg-neutral-800' };
}

/**
 * 组件：聊天气泡 (ChatBubble)
 * 作用：页面上每一次 AI 说话和人类讲话渲染的最底层细胞级视觉对象。
 * 包含：文本布局渲染、多文件下载卡片、安全风控红色警告特殊样式、交互式多重身份鉴别头和时间显示器。
 */
export default function ChatBubble({ role, content, messageId, createdAt, onDelete, profilePicture, nickname, isHighlighted, fileAttachments }: Props) {
  // 判断当前是不是操作员自己，如果是则放在右侧，别人或是 AI 在左侧
  const isUser = role === 'user';
  // 风控系统专属样式门限：如果是真人之力介入或者是系统级警告，走特殊的警戒红样式处理
  const isSupportMessage = !isUser && (content.includes('[Lumi Support Team]') || content.includes('[Safety Support]'));
  const [showConfirm, setShowConfirm] = useState(false);

  // Parse fileAttachments if it's a string (from DB) (反序列化如果传过来的是旧的数据记录体系的字符串 JSON)
  let parsedAttachments: FileAttachment[] = [];
  if (fileAttachments) {
    parsedAttachments = fileAttachments;
  }

  // Split content: remove the 【已上传文件】 line from display since we'll show file cards
  // 特殊指令过滤槽：因为后端传给大模型为了理解上下文拼贴了硬文本在头上，所以前端吐回来的时候必须把这个痕迹抹掉
  const displayContent = content.replace(/\n\n【已上传文件】.+$/, '').trim();

  // 若存在一空壳信息且这是 AI 的（证明正处于数据打字流建立 TCP 之前的思考时间 Loading Status）
  if (role === 'assistant' && content === '') {
    return (
      <div className="flex justify-start">
        {/* Loading 波浪跳动点点特效 */}
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
    // group 类名为了使 Hover 展示的时间和删除按钮生效。对于搜索触发的高亮条加一个 animate-highlight-flash 挂起动效。
    <div className={`group relative flex ${isUser ? 'justify-end' : 'justify-start'} items-end gap-1.5 mb-1 ${isHighlighted ? 'animate-highlight-flash' : ''}`}>
      
      {/* Delete button — left side for user messages (如果是用户的消息，在气泡左端放置垃圾桶按钮) */}
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

      {/* 气泡本体底座 */}
      <div
        className={`
          max-w-[75%]
          rounded-2xl
          text-sm
          leading-relaxed
          overflow-hidden
          ${isUser
            // 用户：骚紫，向右下切圆角，厚实边框阴影
            ? 'bg-purple-600 dark:bg-purple-700 text-white rounded-br-md shadow-md shadow-purple-200/40 dark:shadow-purple-900/40'
            : isSupportMessage
              // 管理介入/危机拦截态：血红底色外发光，强硬警告
              ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border-2 border-red-300/60 dark:border-red-700/40 rounded-bl-md shadow-sm shadow-red-200/30 dark:shadow-red-900/20'
              // 默认 AI 日常沟通：全透明毛玻璃加一点点细边
              : 'bg-white/80 dark:bg-[#1e1b2e] text-neutral-700 dark:text-neutral-200 border border-purple-100/40 dark:border-purple-800/30 rounded-bl-md shadow-sm'
          }
        `}
      >
        {/* 文字显示区采用 whitespace-pre-wrap 尊重用户的按下了的回车换行动作 */}
        <div className="px-4 py-3 whitespace-pre-wrap">{displayContent}</div>

        {/* File Attachments 区 (使用 Framer 增加装载抽屉效果) */}
        <AnimatePresence>
          {parsedAttachments.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0, scale: 0.95 }}
              animate={{ opacity: 1, height: 'auto', scale: 1 }}
              exit={{ opacity: 0, height: 0, scale: 0.95 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={`px-3 pb-3 space-y-1.5 overflow-hidden ${displayContent ? 'pt-0' : 'pt-3'}`}
            >
              {parsedAttachments.map((file, i) => {
                // 读取刚才通过路由解析拿出来的对应色彩和表情集
                const { icon, color } = getFileIcon(file.type, file.name);
                return (
                  <motion.a
                    initial={{ x: -10, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: i * 0.1, duration: 0.2 }} // 阶梯动画
                    key={i}
                    href={file.url} // 一点开就跳转大屏预览或者触发系统下载器
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`
                      flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-200
                      ${isUser
                        ? 'bg-white/15 hover:bg-white/25' // 自身气泡时的高对比卡片颜色
                        : 'bg-neutral-50 dark:bg-white/5 hover:bg-neutral-100 dark:hover:bg-white/10 border border-neutral-200/50 dark:border-purple-800/20'
                      }
                    `}
                  >
                    <div className={`w-8 h-8 rounded-lg ${isUser ? 'bg-white/20' : color} flex items-center justify-center shrink-0`}>
                      <span className="text-sm">{icon}</span>
                    </div>
                    {/* 文件名长了自动折断成... 省略号 */}
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-medium truncate ${isUser ? 'text-white' : 'text-neutral-700 dark:text-neutral-200'}`}>
                        {file.name}
                      </div>
                      <div className={`text-[10px] ${isUser ? 'text-white/60' : 'text-neutral-400 dark:text-neutral-500'}`}>
                        {formatFileSize(file.size)}
                      </div>
                    </div>
                    {/* 小下载指引箭头 */}
                    <svg className={`w-3.5 h-3.5 shrink-0 ${isUser ? 'text-white/50' : 'text-neutral-400 dark:text-neutral-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </motion.a>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* User avatar — right side 用户侧如果有配置自己的微信图或者谷歌头像就亮起 */}
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

      {/* Delete button — right side for assistant messages (AI 发的东西则把垃圾桶放在右边对应匹配) */}
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

      {/* Timestamp — shown on hover (平时隐藏的绝对时间，鼠标去摸的时候才会悬浮显示在底部) */}
      {createdAt && (
        <div className={`absolute ${isUser ? 'right-0' : 'left-0'} -bottom-5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none`}>
          <span className="text-[10px] text-neutral-400 dark:text-neutral-600 whitespace-nowrap">{formatTime(createdAt)}</span>
        </div>
      )}

      {/* Confirm delete dialog (防止用户手滑把长文干掉了加的模态小弹窗) */}
      {showConfirm && messageId && onDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowConfirm(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirm delete message"
            className="bg-[#faf7f2] dark:bg-[#1e1b2e] rounded-2xl shadow-2xl border border-purple-100/60 dark:border-purple-800/40 w-80 overflow-hidden"
            onClick={e => e.stopPropagation()} // 阻断点击渗透：防止把事件传递给背景黑膜搞得连带撤销触发
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
