import { useState, useCallback } from 'react';

/**
 * 核心钩子：安全模式状态管理 (useSafeMode)
 * 
 * 职责：
 * 1. 追踪前端应用中哪些特定会话已进入“安全模式”（即检测到危机，等待干预）。
 * 2. 控制侧边栏及聊窗的警告 UI 展示。
 * 3. 提供统一的触发、同步与解除安全模式的 API 接口。
 */
export function useSafeMode() {
    // 处于安全模式的会话 ID 集合 (使用 Set 保证唯一性)
    const [safeModeConvIds, setSafeModeConvIds] = useState<Set<string>>(new Set());
    
    // 标识管理员是否正在通过后台干预 (用于 UI 反馈)
    const [isAdminTyping, setIsAdminTyping] = useState(false);

    /**
     * 函数：同步状态 (syncSafeModeConversations)
     * 作用：通常在初始化加载会话列表时，从服务端拉取所有已标记为危机的 ID。
     */
    const syncSafeModeConversations = useCallback((convIds: string[]) => {
        setSafeModeConvIds(new Set(convIds));
    }, []);

    /**
     * 函数：状态查询 (hasSafeMode)
     * 作用：判断给定的会话 ID 是否处于干预模式。
     */
    const hasSafeMode = useCallback((convId: string) => {
        return safeModeConvIds.has(convId);
    }, [safeModeConvIds]);

    /**
     * 函数：触发安全模式 (triggerSafeMode)
     * 作用：当 Chat API 返回 X-Safe-Mode 响应头时，前端立即锁定当前会话。
     */
    const triggerSafeMode = useCallback((convId: string) => {
        setSafeModeConvIds((prev) => new Set([...prev, convId]));
    }, []);

    /**
     * 函数：解除安全模式 (resolveSafeMode)
     * 作用：当管理员解决了危机或用户状态恢复正常时调用。
     */
    const resolveSafeMode = useCallback((convId: string) => {
        setSafeModeConvIds((prev) => {
            const next = new Set(prev);
            next.delete(convId);
            return next;
        });
    }, []);

    return {
        hasSafeMode,
        triggerSafeMode,
        syncSafeModeConversations,
        resolveSafeMode,
        isAdminTyping,
        setIsAdminTyping,
    };
}
