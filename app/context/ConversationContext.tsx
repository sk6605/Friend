'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * 类型：会话 (Conversation)
 */
interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 接口：会话上下文类型定义
 */
interface ConversationContextType {
  conversations: Conversation[]; // 全局维护的会话列表
  addConversation: (conversation: Conversation) => void;
  updateConversationTitle: (id: string, title: string) => void;
  removeConversation: (id: string) => void;
  fetchConversations: (userId?: string) => Promise<void>;
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

/**
 * 组件：会话状态提供者 (ConversationProvider)
 * 作用：在整个应用生命周期内管理用户的聊天列表，实现侧边栏与主聊窗的数据同步。
 */
export function ConversationProvider({ children }: { children: React.ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);

  // 获取会话列表：通常在用户登录后或应用启动时调用
  const fetchConversations = useCallback(async (userId?: string) => {
    try {
      const url = userId
        ? `/api/conversations?userId=${userId}`
        : '/api/conversations';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  }, []);

  /**
   * 业务逻辑 A：创建新对话时同步 UI
   * 无需刷新页面，直接将新生成的会话对象插入列表首位。
   */
  const addConversation = useCallback((conversation: Conversation) => {
    setConversations(prev => [conversation, ...prev]);
  }, []);

  /**
   * 业务逻辑 B：智能命名 (Summarize Title) 同步
   * 当 AI 在后台生成新的摘要标题后，调用此函数确保侧边栏的标题实时更新，而不会丢失当前活跃状态。
   */
  const updateConversationTitle = useCallback((id: string, title: string) => {
    setConversations(prev =>
      prev.map(conv =>
        conv.id === id ? { ...conv, title } : conv
      )
    );
  }, []);

  /**
   * 业务逻辑 C：物理删除会话同步
   * 从数组中剔除指定 ID。如果删除的是当前正在查看的房间，外部组件会监听此变化并跳转到 '/'。
   */
  const removeConversation = useCallback((id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
  }, []);

  return (
    <ConversationContext.Provider
      value={{
        conversations,
        addConversation,
        updateConversationTitle,
        removeConversation,
        fetchConversations,
      }}
    >
      {children}
    </ConversationContext.Provider>
  );
}

/**
 * 钩子：使用会话上下文 (useConversations)
 */
export function useConversations() {
  const context = useContext(ConversationContext);
  if (context === undefined) {
    throw new Error('useConversations must be used within a ConversationProvider');
  }
  return context;
}
