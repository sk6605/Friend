import { useState, useCallback } from 'react';

/**
 * 核心功能：安全模式状态管理 (Safe Mode State Management)
 *
 * 职责 (Responsibilities):
 * 1. 追踪哪些特定的对话触发了安全模式 (Track which specific conversations triggered safe mode).
 * 2. 管理安全提示横幅的关闭状态 (Manage the dismissed state of the safe mode banner, using sessionStorage).
 * 3. 提供统一触发和解除安全模式的 API (Provide a unified API to trigger or dismiss safe mode).
 */
export function useSafeMode() {
    // 保存触发了安全模式的对话 ID 集合 (Set of conversation IDs that triggered safe mode)
    const [safeModeConvIds, setSafeModeConvIds] = useState<Set<string>>(new Set());

    // 控制横幅是否被用户手动关闭 (Controls whether the banner has been manually dismissed by the user)
    const [safeModeDismissed, setSafeModeDismissed] = useState(() => {
        if (typeof window !== 'undefined') {
            return sessionStorage.getItem('safeModeBannerDismissed') === 'true';
        }
        return false;
    });

    // 批量同步来自后端数据库的处于安全模式的对话 (Sync safe mode convs from backend)
    const syncSafeModeConversations = useCallback((convIds: string[]) => {
        setSafeModeConvIds(new Set(convIds));
    }, []);

    // 检查特定对话也是否处于安全模式 (Check if specific conv is in safe mode)
    const hasSafeMode = useCallback((convId: string) => {
        return safeModeConvIds.has(convId);
    }, [safeModeConvIds]);

    /**
     * 触发安全模式 (Trigger safe mode for a specific conversation)
     * 通常在服务器返回 'X-Safe-Mode' 头或流返回紧急中断信号时调用
     * (Called when server returns 'X-Safe-Mode' header or stream aborts for crisis)
     */
    const triggerSafeMode = useCallback((convId: string) => {
        setSafeModeConvIds((prev) => new Set([...prev, convId]));
        setSafeModeDismissed(false);
        sessionStorage.removeItem('safeModeBannerDismissed');
    }, []);

    /**
     * 关闭安全提示横幅 (Dismiss the safe mode banner)
     * 仅在前端视觉上隐藏横幅，但对话依然处于安全模式
     * (Visually hides the banner, but the conversation remains in safe mode constraints)
     */
    const dismissSafeModeBanner = useCallback(() => {
        setSafeModeDismissed(true);
        sessionStorage.setItem('safeModeBannerDismissed', 'true');
    }, []);

    return {
        hasSafeMode,
        isSafeModeDismissed: safeModeDismissed,
        triggerSafeMode,
        dismissSafeModeBanner,
        syncSafeModeConversations,
    };
}
