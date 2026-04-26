"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface ChatInputProps {
  onSendMessage: (message: string, files?: File[]) => Promise<void>;
  isLoading?: boolean;
  showUpload?: boolean;
  onStartVoice?: () => void;
  isVoiceActive?: boolean;
}

/**
 * 组件：聊天输入中控器 (ChatInput)
 * 作用：处理用户侧的全部文字、附件、语音录入动作。包含自适应高度输入框。
 * 细节：当用户发送消息后，立即释放当前状态以便实现最高的 UI 响应率 (Fire & Forget 模式)。
 */
export default function ChatInput({ onSendMessage, isLoading = false, showUpload = true, onStartVoice, isVoiceActive = false }: ChatInputProps) {
  // 核心文本流暂存器
  const [text, setText] = useState("");
  // 队列附件暂存器（等待飞向 OSS 的文件们）
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  // DOM 引用句柄，用于跳过 React 原生限制直接操作元素
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevVoiceActiveRef = useRef(false);

  // Auto-resize textarea (伸缩盒：让输入框能够随着多行文字的增加自己撑开，最高120px)
  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto'; // 先清空，再重构，强制发生 reflow 计算出真实高度
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    }
  }, []);

  // 当文字发生敲击变化时重新计算它的体型
  useEffect(() => {
    adjustHeight();
  }, [text, adjustHeight]);

  // Auto-focus input when AI finishes responding (自动聚焦：当大模型答复完毕，立刻将焦点抢回输入框，准备下一轮连射)
  useEffect(() => {
    if (!isLoading) {
      textareaRef.current?.focus();
    }
  }, [isLoading]);

  // Re-focus textarea when voice input ends (声音模式退出后也会抢占光标)
  useEffect(() => {
    if (prevVoiceActiveRef.current && !isVoiceActive) {
      // Delay to let the VoiceVisualizer exit animation finish (400ms 避开动画退场重叠问题)
      const timer = setTimeout(() => textareaRef.current?.focus(), 450);
      return () => clearTimeout(timer);
    }
    prevVoiceActiveRef.current = isVoiceActive;
  }, [isVoiceActive]);

  /**
   * 动作处理器：发送按钮被怒砸
   */
  const handleSend = () => {
    // 防御：如果是空内容或者对方正在输出，禁止发射
    if ((!text.trim() && uploadedFiles.length === 0) || isLoading) return;

    // Capture values before clearing so the send uses them (复制现场记忆体，准备扔给父级去发射异步导弹)
    const messageText = text;
    const messageFiles = uploadedFiles.length > 0 ? [...uploadedFiles] : undefined;

    // Clear immediately for responsive UX (闪电清稿：不等网络是否回来，就先把输入框置空，营造 0 毫秒卡顿的假象)
    setText("");
    setUploadedFiles([]);

    // Fire and forget — don't await the full stream (发射！)
    onSendMessage(messageText, messageFiles);

    // Re-focus input after sending
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  /**
   * 动作处理器：捕捉文件选择器中新抓进来的文件
   */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      // 推入已上传文件队列
      setUploadedFiles(prev => [...prev, ...Array.from(files)]);
    }
  };

  /**
   * 动作处理器：触发真实的原生 file input 进行挑选
   */
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  /**
   * 动作处理器：撤销或踢出一个预载好的上传文件
   */
  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    // 强制清理浏览器 input 里的内存地址，防止删掉后立马选同一个文件引发 onChange 不触发
    if (fileInputRef.current && uploadedFiles.length === 1) {
      fileInputRef.current.value = "";
    }
  };

  /**
   * 快捷键：监听纯粹按下 Enter 键且不带 Shift 键
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-4 bg-transparent">
      {/* 
        主包装器结构
        包含一个透明的高斯模糊药丸底座 
      */}
      <div className="
        relative
        flex items-center gap-2
        bg-white/40 dark:bg-[#1e1e1e]/40 backdrop-blur-2xl
        rounded-3xl
        border border-purple-100/30 dark:border-purple-800/20
        shadow-lg shadow-purple-900/5
        p-2
        transition-all duration-300
        focus-within:ring-2 focus-within:ring-purple-400/30 focus-within:border-purple-300/50 dark:focus-within:border-purple-600/50
      ">
        {/* Upload button wrapper (左侧阵营：附件与麦克风) */}
        <div className="flex shrink-0">
          {showUpload && (
            <>
              {/* 被隐藏的真实原盘 Input，接受文件 MIME 过滤器 */}
              <input
                ref={fileInputRef}
                type="file"
                title="Upload file"
                onChange={handleFileSelect}
                className="hidden"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.md,.json,.png,.jpg,.jpeg,.gif,.webp"
                multiple
                disabled={isLoading}
              />
              <button
                onClick={handleUploadClick}
                disabled={isLoading}
                className="
                  w-10 h-10
                  rounded-full
                  flex items-center justify-center
                  text-neutral-500 dark:text-neutral-400
                  hover:bg-purple-100/50 dark:hover:bg-white/10
                  hover:text-purple-600 dark:hover:text-purple-300
                  transition-all duration-200
                "
                aria-label="Upload file"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            </>
          )}

          {/* Mic button (语音录入启动口) */}
          {onStartVoice && (
            <button
              onClick={onStartVoice}
              disabled={isLoading}
              className="
                w-10 h-10
                rounded-full
                flex items-center justify-center
                text-neutral-500 dark:text-neutral-400
                hover:bg-purple-100/50 dark:hover:bg-white/10
                hover:text-purple-600 dark:hover:text-purple-300
                transition-all duration-200
              "
              aria-label="Start voice mode"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            </button>
          )}
        </div>

        {/* 核心中控板：随字数增长的自动扩大 TextArea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown} // 劫持回车键
          disabled={isLoading}
          placeholder="Ask anything..."
          rows={1}
          className="
            flex-1
            max-h-[120px]
            py-3 px-2
            bg-transparent
            text-neutral-800 dark:text-neutral-100 
            placeholder-neutral-400 dark:placeholder-neutral-500
            text-base
            outline-none
            resize-none
            leading-relaxed
          "
        />

        {/* 右侧发射阵地：打火机旋钮区 */}
        <button
          onClick={handleSend}
          disabled={isLoading || (!text.trim() && uploadedFiles.length === 0)}
          aria-label="Send message"
          className={`
            w-10 h-10
            rounded-full
            flex items-center justify-center shrink-0
            transition-all duration-200
            ${(isLoading || (!text.trim() && uploadedFiles.length === 0))
              ? 'text-neutral-300 dark:text-neutral-600 cursor-not-allowed' // 空弹夹时的冷却态
              : 'text-white bg-purple-600 hover:bg-purple-700 shadow-md transform hover:scale-105' // 随时准备爆发！
            }
          `}
        >
          {/* 发射或者等待圆环 Loader (处理 isLoading 的动画) */}
          {isLoading ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          )}
        </button>
      </div>

      {/* File preview (左上方弹出的小气泡：告诉你已经选中了哪些文件) */}
      {showUpload && uploadedFiles.length > 0 && (
        <div className="absolute bottom-full left-0 mb-2 ml-4 flex gap-2">
          {uploadedFiles.map((file, index) => (
            <div key={index} className="flex items-center gap-2 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-purple-100/50 shadow-sm text-xs animate-slide-in">
              <span className="text-neutral-600 dark:text-neutral-300 truncate max-w-[150px]">{file.name}</span>
              <button onClick={() => removeFile(index)} className="text-neutral-400 hover:text-red-500">&times;</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
