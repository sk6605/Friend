"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface ChatInputProps {
  onSendMessage: (message: string, files?: File[]) => Promise<void>;
  isLoading?: boolean;
  showUpload?: boolean;
  onStartVoice?: () => void;
}

export default function ChatInput({ onSendMessage, isLoading = false, showUpload = true, onStartVoice }: ChatInputProps) {
  const [text, setText] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    }
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [text, adjustHeight]);

  // Auto-focus input when AI finishes responding
  useEffect(() => {
    if (!isLoading) {
      textareaRef.current?.focus();
    }
  }, [isLoading]);

  const handleSend = () => {
    if ((!text.trim() && uploadedFiles.length === 0) || isLoading) return;

    // Capture values before clearing so the send uses them
    const messageText = text;
    const messageFiles = uploadedFiles.length > 0 ? [...uploadedFiles] : undefined;

    // Clear immediately for responsive UX
    setText("");
    setUploadedFiles([]);

    // Fire and forget — don't await the full stream
    onSendMessage(messageText, messageFiles);

    // Re-focus input after sending
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setUploadedFiles(prev => [...prev, ...Array.from(files)]);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    if (fileInputRef.current && uploadedFiles.length === 1) {
      fileInputRef.current.value = "";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-4 bg-transparent">
      <div className="
        relative
        flex items-center gap-2
        bg-white/50 dark:bg-[#1e1e1e]/60 backdrop-blur-xl
        rounded-3xl
        border border-purple-100/50 dark:border-purple-800/30
        shadow-lg shadow-purple-900/5
        p-2
        transition-all duration-300
        focus-within:ring-2 focus-within:ring-purple-400/30 focus-within:border-purple-300/50 dark:focus-within:border-purple-600/50
      ">
        {/* Upload button wrapper */}
        <div className="flex shrink-0">
          {showUpload && (
            <>
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

          {/* Mic button */}
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

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
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

        <button
          onClick={handleSend}
          disabled={isLoading || (!text.trim() && uploadedFiles.length === 0)}
          className={`
            w-10 h-10
            rounded-full
            flex items-center justify-center shrink-0
            transition-all duration-200
            ${(isLoading || (!text.trim() && uploadedFiles.length === 0))
              ? 'text-neutral-300 dark:text-neutral-600 cursor-not-allowed'
              : 'text-white bg-purple-600 hover:bg-purple-700 shadow-md transform hover:scale-105'
            }
          `}
        >
          {isLoading ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          )}
        </button>
      </div>

      {/* File preview - Moved below or above? keeping above but styled consistently */}
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
