import { useState } from 'react';

/**
 * 消息对象的结构定义
 * Interface defining the structure of a chat message.
 */
export interface Message {
    id?: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt?: string;
}

/**
 * useChatStream 所需的配置参数 
 * Props required for the useChatStream hook.
 */
interface UseChatStreamProps {
    userId: string;
    initialConvId: string | undefined;
    addConversation: (conv: any) => void;
    updateConversationTitle: (id: string, title: string) => void;
    onSafeModeTrigger?: (convId: string) => void;
    isVoice?: boolean;
    speak?: (text: string) => void;
}

/**
 * 核心 Hooks: useChatStream
 * 负责处理聊天对话的所有网络请求、流式读取 (Streaming)、断线重连 (Auto-reconnect) 和文件上传逻辑。
 * 
 * Core Hook for Chat Streaming.
 * Handles API calls, stream reading, auto-reconnection, and file uploads.
 */
export function useChatStream({
    userId,
    initialConvId,
    addConversation,
    updateConversationTitle,
    onSafeModeTrigger,
    isVoice,
    speak
}: UseChatStreamProps) {

    // 状态管理 / State Management
    const [messages, setMessages] = useState<Message[]>([]); // 聊天消息列表 / List of messages
    const [currentConvId, setCurrentConvId] = useState(initialConvId ?? ''); // 当前对话的 ID / Active conversation ID
    const [isLoading, setIsLoading] = useState(false); // 是否正在等待 AI 响应 (显示思考动画) / Shows thinking dots
    const [isStreaming, setIsStreaming] = useState(false); // 是否处于流式响应进行中 (锁定输入框) / Locks input during stream

    /**
     * waitForNetwork()
     * 断线重连机制：等待网络恢复在线。
     * Auto-reconnection resilience. Returns a Promise that resolves when navigator.onLine becomes true.
     */
    const waitForNetwork = (): Promise<void> => {
        if (navigator.onLine) return Promise.resolve();
        return new Promise<void>((resolve) => {
            const handler = () => {
                window.removeEventListener('online', handler);
                resolve();
            };
            window.addEventListener('online', handler);
            // 安全机制：最多等待 60 秒，超时则继续 (可能网络并没有完全断开，只是探测失败)
            // Safety: don't wait forever (60s limit)
            setTimeout(() => {
                window.removeEventListener('online', handler);
                resolve();
            }, 60_000);
        });
    };

    /**
     * readWithTimeout(reader, ms)
     * 带超时机制的流式读取器，防止由于网络原因导致 stream 挂起。
     * Prevents stream hanging. Races the reader.read() against a timeout (ms).
     */
    const readWithTimeout = (
        reader: ReadableStreamDefaultReader<Uint8Array>,
        ms: number,
    ): Promise<ReadableStreamReadResult<Uint8Array>> => {
        let timer: ReturnType<typeof setTimeout>;
        const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('STREAM_TIMEOUT')), ms);
        });
        return Promise.race([reader.read(), timeout]).finally(() => clearTimeout(timer));
    };

    /**
     * 检查错误是否属于网络相关错误
     * Detects if an error is network related.
     */
    const isNetworkError = (err: unknown): boolean => {
        if (err instanceof TypeError) return true; // fetch network error (TypeError is thrown by fetch on unreachability)
        if (err instanceof Error) {
            const m = err.message.toLowerCase();
            return (
                m === 'stream_timeout' ||
                m.includes('network') ||
                m.includes('failed to fetch') ||
                m.includes('aborted') ||
                m.includes('load failed')
            );
        }
        return false;
    };

    /**
     * setLocalMessages(msgs)
     * 允许外部组件 (如 ChatPage) 手动更新或覆盖本地消息列表 (例如用于清空或初次加载)
     * Allows external components to override messages (e.g. initial load or deletion).
     */
    const setLocalMessages: React.Dispatch<React.SetStateAction<Message[]>> = setMessages;

    /**
     * handleSendMessage(userMessage, files)
     * 发送消息的主编排器函数 (Orchestrator)
     * 步骤:
     * 1. 乐观 UI 更新：立即将用户消息显示在屏幕上 (Optimistic UI)
     * 2. 如果没有对话 ID，则调用 API 创建新对话 (Creates conversation if none exists)
     * 3. 如果带有附件，先上传文件并获取 URLs (Uploads files first)
     * 4. 调用 /api/chat 发起流式请求 (Starts streaming process)
     * 5. 处理重试机制 (Retry loop for network resilience)
     */
    const handleSendMessage = async (userMessage: string, files?: File[]) => {
        let convId = currentConvId;

        // 1. 如果当前没有活跃对话，自动创建一个
        // If no active conversation, create one.
        if (!convId) {
            try {
                const response = await fetch('/api/conversations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: userMessage.substring(0, 50), userId }),
                });

                const newConversation = await response.json();
                convId = newConversation.id;
                setCurrentConvId(convId);
                addConversation(newConversation); // Update sidebar state
                updateConversationTitle(newConversation.id, newConversation.title);
            } catch (error) {
                console.error('创建对话失败 / Error creating conversation:', error);
                return;
            }
        }

        // 2. 准备要在UI上显示的内容 (如果带有文件附件)
        // Prepare display content with file tags
        const displayContent = files && files.length > 0
            ? `${userMessage}\n\n【已上传文件】${files.map(f => f.name).join(', ')}`
            : userMessage;

        // 更新本地组件状态 (乐观UI，立即上屏)
        // Update local state (Optimistic UI)
        const updatedMessages: Message[] = [
            ...messages,
            { role: 'user', content: displayContent },
        ];
        setMessages(updatedMessages);
        setIsLoading(true); // 显示"思考中"动画
        setIsStreaming(true); // 锁定输入框

        try {
            // 3. 处理文件上传 (Upload files logic)
            let fileUrls: string[] = [];
            let fileMetadata: { name: string; size: number; type: string }[] = [];

            if (files && files.length > 0) {
                const formData = new FormData();
                files.forEach(f => formData.append('files', f));

                const uploadRes = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData,
                });

                if (uploadRes.ok) {
                    const uploadData = await uploadRes.json();
                    fileUrls = uploadData.files.map((f: any) => f.url);
                    fileMetadata = uploadData.files.map((f: any) => ({
                        name: f.name,
                        size: f.size,
                        type: f.type,
                    }));
                }
            }

            // 将用户消息存入数据库 (Fire-and-forget: 发出去就不用等结果了)
            // Save user message to DB asynchronously
            fetch(`/api/conversations/${convId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: 'user', content: displayContent }),
            });

            // 4. 发起核心的聊天流式请求 (Stream with auto-retry)
            let assistantText = '';
            let bubbleInserted = false;
            const MAX_RETRIES = 2; // 最多重试2次
            let attempt = 0;

            while (attempt <= MAX_RETRIES) {
                try {
                    const response = await fetch('/api/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            messages: updatedMessages,
                            conversationId: convId,
                            userId,
                            // 如果是重试，则把之前已经生成的一半内容传回给服务器，让大模型接着写
                            // On retry, send partial text so AI continues from where it stopped
                            resumeAssistant: attempt > 0 && assistantText ? assistantText : undefined,
                            fileUrls: fileUrls.length > 0 ? fileUrls : undefined,
                            fileMetadata: fileMetadata.length > 0 ? fileMetadata : undefined,
                        }),
                    });

                    // 处理常见的接口错误 (例如每日消息限额已达上限)
                    // Handle standard HTTP errors (e.g. daily limit reached)
                    if (!response.ok) {
                        const errBody = await response.json().catch(() => ({}));
                        if (errBody.limitReached) {
                            setMessages(prev => [
                                ...prev,
                                { role: 'assistant', content: `You've used all ${errBody.dailyLimit} messages for today! Come back tomorrow, or upgrade your plan for unlimited messages. 💜` },
                            ]);
                            return; // 直接退出，不再重试
                        }
                        throw new Error(errBody.error || `AI response failed (${response.status})`);
                    }

                    // 如果服务器返回的安全模式标记为 true，触发回调通知 ChatPage
                    // Detect SAFE_MODE activation from server response headers
                    if (response.headers.get('X-Safe-Mode') === 'true') {
                        if (onSafeModeTrigger) onSafeModeTrigger(convId);
                    }

                    const reader = response.body?.getReader();
                    if (!reader) throw new Error('No response body');

                    const decoder = new TextDecoder();
                    let started = assistantText.length > 0;

                    // 在UI中插入一个空的 Assistant 气泡，准备接收流式数据
                    // Insert empty assistant bubble only on the very first attempt
                    if (!bubbleInserted) {
                        setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
                        bubbleInserted = true;
                    }

                    const CHUNK_TIMEOUT = 45_000; // 每个流式块(Chunk)的最大等待时间: 45秒

                    // ✅ 开始逐块读取流 (The Streaming Loop)
                    while (true) {
                        const { value, done } = await readWithTimeout(reader, CHUNK_TIMEOUT);
                        if (done) break;

                        const chunk = decoder.decode(value, { stream: true });
                        assistantText += chunk;

                        if (!started && assistantText.trim().length > 0) {
                            started = true;
                            setIsLoading(false); // 收到第一个字节时，隐藏思考动画
                        }

                        // 更新最后一条(即刚插入的Assistant)消息的内容
                        setMessages(prev => {
                            const copy = [...prev];
                            const lastIndex = copy.length - 1;
                            if (copy[lastIndex]?.role === 'assistant') {
                                copy[lastIndex] = { ...copy[lastIndex], content: assistantText };
                            }
                            return copy;
                        });
                    }

                    // 读取结束后，清空 Decoder 中剩余的字节 (解决中文等宽字符被截断的问题)
                    // Flush any remaining buffered bytes from the TextDecoder
                    const remaining = decoder.decode();
                    if (remaining) {
                        assistantText += remaining;
                        setMessages(prev => {
                            const copy = [...prev];
                            const lastIndex = copy.length - 1;
                            if (copy[lastIndex]?.role === 'assistant') {
                                copy[lastIndex] = { ...copy[lastIndex], content: assistantText };
                            }
                            return copy;
                        });
                    }

                    break; // 流式读取成功完成，毫无异常，退出重试循环 (Success! Break retry loop)

                } catch (streamError) {
                    // ⚠️ 处理流式中断或网络错误 (Handle Stream Interruption/Network Error)
                    if (isNetworkError(streamError) && attempt < MAX_RETRIES) {
                        attempt++;
                        console.warn(`流式读取中断，准备第 ${attempt}/${MAX_RETRIES} 次重试...`);

                        // 在界面上提示用户正在重新连接
                        // Show reconnecting hint in the assistant bubble
                        setMessages(prev => {
                            const copy = [...prev];
                            const lastIndex = copy.length - 1;
                            if (copy[lastIndex]?.role === 'assistant') {
                                copy[lastIndex] = {
                                    ...copy[lastIndex],
                                    content: assistantText + '\n\n⏳ *Reconnecting... (正在重新连接...)*',
                                };
                            }
                            return copy;
                        });

                        // 等待网络恢复在线后再重试
                        await waitForNetwork();
                        await new Promise(r => setTimeout(r, 2000)); // 额外缓冲2秒让连接稳定

                        // 恢复之前的内容，移除重连提示
                        setMessages(prev => {
                            const copy = [...prev];
                            const lastIndex = copy.length - 1;
                            if (copy[lastIndex]?.role === 'assistant') {
                                copy[lastIndex] = { ...copy[lastIndex], content: assistantText };
                            }
                            return copy;
                        });

                        setIsLoading(true);
                        continue; // 继续下一轮重试 (Continue to Next Attempt)
                    }

                    // 非网络错误，或达到最大重试次数，直接抛出异常结束
                    throw streamError;
                }
            }

            // 5. 收尾工作：将完整的 AI 回复保存到数据库 (Save assistant message to database)
            if (assistantText.trim()) {
                fetch(`/api/conversations/${convId}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ role: 'assistant', content: assistantText }),
                }).catch(err => console.error('保存回复失败 / Error saving assistant message:', err));

                // 如果开启了语音功能，自动朗读 AI 的回答
                if (isVoice && speak) {
                    speak(assistantText);
                }
            }

            // 为了确保左侧边栏列表标题同步更新，轮询获取最新标题 (因为标题是在服务端异步生成的)
            // Refetch async generated conversation title (sync with sidebar)
            const refreshTitle = async () => {
                try {
                    const convResp = await fetch(`/api/conversations/${convId}?userId=${userId}`);
                    if (convResp.ok) {
                        const updatedConv = await convResp.json();
                        updateConversationTitle(convId, updatedConv.title);
                    }
                } catch (err) { /* ignore */ }
            };
            refreshTitle();
            setTimeout(refreshTitle, 5000);

        } catch (error) {
            console.error('发送消息异常 / Error sending message:', error);
            const errMsg = error instanceof Error ? error.message : 'Unknown error';
            // 将报错信息追加到消息气泡末尾
            setMessages(prev => {
                const copy = [...prev];
                const lastIndex = copy.length - 1;
                if (copy[lastIndex]?.role === 'assistant' && copy[lastIndex].content.trim()) {
                    copy[lastIndex] = {
                        ...copy[lastIndex],
                        content: copy[lastIndex].content + `\n\n⚠️ *Connection lost. Please send your message again. (连接丢失，请重试)*`,
                    };
                    return copy;
                }
                return [...prev, { role: 'assistant', content: `Sorry, something went wrong: ${errMsg}` }];
            });
        } finally {
            // 收尾工作：释放状态锁定
            setIsLoading(false);
            setIsStreaming(false);
        }
    };

    return {
        messages,
        setLocalMessages,
        currentConvId,
        setCurrentConvId,
        isLoading,
        isStreaming,
        handleSendMessage
    };
}
