import { useState, useEffect } from 'react';

/**
 * 消息对象的结构定义
 */
export interface Message {
    id?: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt?: string;
    fileAttachments?: { name: string; url: string; size: number; type: string }[];
}

/**
 * useChatStream 所需的配置参数 
 */
interface UseChatStreamProps {
    userId: string;
    initialConvId: string | undefined;
    addConversation: (conv: any) => void; // 用于向侧边栏添加新会话
    updateConversationTitle: (id: string, title: string) => void; // 用于同步侧边栏标题
    onSafeModeTrigger?: (convId: string) => void; // 当触发安全模式时的回调
    isVoice?: boolean; // 是否开启语音朗读
    speak?: (text: string) => void; // 语音合成函数
    checkSafeMode?: (id: string) => boolean; // 检查当前是否处于危机干预状态
}

/**
 * 核心 Hooks: useChatStream
 * 负责处理聊天对话的所有网络交互。
 * 
 * 核心特性：
 * 1. 乐观 UI (Optimistic UI)：发送即上屏。
 * 2. 流式响应 (Streaming)：实时展示 AI 生成的内容。
 * 3. 弹性连接 (Resilience)：具备断线重连、超时处理以及自动恢复上下文的重试机制。
 * 4. 危机轮询 (SafeMode Polling)：当账户受限时，切换为短轮询模式接收人工回复。
 */
export function useChatStream({
    userId,
    initialConvId,
    addConversation,
    updateConversationTitle,
    onSafeModeTrigger,
    isVoice,
    speak,
    checkSafeMode
}: UseChatStreamProps) {

    // ─── 状态管理 ───
    const [messages, setMessages] = useState<Message[]>([]); // 消息列表缓存
    const [currentConvId, setCurrentConvId] = useState(initialConvId ?? ''); // 当前会话 ID
    const [isLoading, setIsLoading] = useState(false); // 是否正在加载（显示思考动画）
    const [isStreaming, setIsStreaming] = useState(false); // 是否处于流输出中（禁用发送按钮）

    /**
     * 逻辑：危机干预轮询机制
     * 当 checkSafeMode 返回 true 时，由于 AI 已被静默，我们需要定期向服务器请求数据，
     * 以便实时接收管理员发送的人工干预/指导消息。
     */
    useEffect(() => {
        const isSafe = checkSafeMode && currentConvId ? checkSafeMode(currentConvId) : false;
        if (!isSafe || !currentConvId) return;

        const fetchMessages = () => {
            fetch(`/api/conversations/${currentConvId}?userId=${userId}`)
                .then(res => {
                    if (!res.ok) return null;
                    return res.json();
                })
                .then(data => {
                    if (data && data.messages) {
                        setMessages(prev => {
                            // 仅当数据库返回的消息数量更多或内容有变时更新，避免 UI 抖动
                            if (data.messages.length > prev.length) {
                                return data.messages;
                            } else if (data.messages.length === prev.length && prev.length > 0) {
                                const lastDb = data.messages[data.messages.length - 1];
                                const lastLocal = prev[prev.length - 1];
                                if (lastDb && lastLocal && lastDb.content !== lastLocal.content) {
                                    return data.messages;
                                }
                            }
                            return prev;
                        });
                    }
                })
                .catch(() => { /* 忽略轮询错误 */ });
        };

        // 立即执行一次，并每 3 秒检测一次
        fetchMessages();
        const timer = setInterval(fetchMessages, 3000);

        return () => clearInterval(timer);
    }, [checkSafeMode, currentConvId, userId]);

    /**
     * 辅助逻辑：断线重连等待
     * 返回一个 Promise，当 navigator.onLine 恢复为 true 时 resolve。
     */
    const waitForNetwork = (): Promise<void> => {
        if (navigator.onLine) return Promise.resolve();
        return new Promise<void>((resolve) => {
            const handler = () => {
                window.removeEventListener('online', handler);
                resolve();
            };
            window.addEventListener('online', handler);
            // 安全冗余：最多等待 60 秒
            setTimeout(() => {
                window.removeEventListener('online', handler);
                resolve();
            }, 60_000);
        });
    };

    /**
     * 辅助逻辑：带超时的读取流
     * 防止在弱网环境下流读取死锁 (Hanging)。
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
     * 辅助逻辑：识别网络类型错误
     */
    const isNetworkError = (err: unknown): boolean => {
        if (err instanceof TypeError) return true; // fetch 的网络中断通常抛出 TypeError
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
     * 暴露给外部刷新消息列表的方法
     */
    const setLocalMessages: React.Dispatch<React.SetStateAction<Message[]>> = setMessages;

    /**
     * 核心逻辑：handleSendMessage (消息编排器)
     * 该函数协调了：会话创建 -> 文件上传 -> UI 乐观更新 -> 数据库保存 -> AI 流式请求 -> 错误重试的全流程。
     */
    const handleSendMessage = async (userMessage: string, files?: File[]) => {
        let convId = currentConvId;

        // 1. 如果是新会话，先进行初始化（创建房间）
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
                addConversation(newConversation); // 同步侧边栏列表
                updateConversationTitle(newConversation.id, newConversation.title);
            } catch (error) {
                console.error('Failed to initialize conversation:', error);
                return;
            }
        }

        // 2. 构造 UI 展示内容（处理文件附件标记）
        const displayContent = files && files.length > 0
            ? `${userMessage}\n\n【已上传文件】${files.map(f => f.name).join(', ')}`
            : userMessage;

        // 3. 乐观 UI 更新：让用户立即看到自己的消息，无需等待后台
        const userTempId = `temp-${Date.now()}`;
        const updatedMessages: Message[] = [
            ...messages,
            { id: userTempId, role: 'user', content: displayContent },
        ];
        setMessages(updatedMessages);

        // 判定安全模式：干预模式下不锁定输入，不显示助理正在输入中 (思考动画)
        const isSafe = checkSafeMode && currentConvId ? checkSafeMode(currentConvId) : false;
        if (!isSafe) {
            setIsLoading(true);
            setIsStreaming(true);
        }

        try {
            // 4. 处理附件上传逻辑
            let fileUrls: string[] = [];
            let fileMetadata: { name: string; size: number; type: string }[] = [];
            let fileExtractedTexts: (string | undefined)[] = [];

            if (files && files.length > 0) {
                const formData = new FormData();
                files.forEach(f => formData.append('files', f));
                formData.append('userId', userId);

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
                    fileExtractedTexts = uploadData.files.map((f: any) => f.extractedText);
                }
            }

            const fileAttachments = fileUrls.length > 0
                ? fileMetadata.map((meta, i) => ({
                    name: meta.name,
                    url: fileUrls[i],
                    size: meta.size,
                    type: meta.type,
                }))
                : undefined;

            // 如果有附件，二次乐观更新 user 消息气泡，挂载真实链接以便即时预览
            if (fileAttachments) {
                setMessages(prev => {
                    const copy = [...prev];
                    const idx = copy.findIndex(m => m.id === userTempId);
                    if (idx > -1) {
                        copy[idx] = { ...copy[idx], content: userMessage, fileAttachments };
                    }
                    return copy;
                });
            }

            // 5. 保存用户消息到数据库 (异步持久化，不阻塞 AI 响应)
            const saveMsgPromise = fetch(`/api/conversations/${convId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role: 'user',
                    content: displayContent,
                    fileAttachments: fileAttachments ? JSON.stringify(fileAttachments) : undefined,
                }),
            });

            // 6. 危机模式检测：如果是人工干预中，则跳过 AI 流输出
            if (isSafe) {
                await saveMsgPromise;
                // 请求聊天 API 仅用于触发后台风险评估逻辑，无需返回文本
                await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messages: updatedMessages,
                        conversationId: convId,
                        userId,
                    }),
                });
                return;
            }

            // 7. 发起 AI 聊天流式请求 (搭载 25s 自动重试接力机制)
            let assistantText = '';
            let bubbleInserted = false;
            const MAX_RETRIES = 2; // 网络抖动重试次数上限
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
                            // 重试接力：若之前已生成半句，通知服务端从该处继续，避免重复消耗 Token
                            resumeAssistant: attempt > 0 && assistantText ? assistantText : undefined,
                            fileUrls: fileUrls.length > 0 ? fileUrls : undefined,
                            fileMetadata: fileMetadata.length > 0 ? fileMetadata : undefined,
                            fileExtractedTexts: fileExtractedTexts.some(t => t) ? fileExtractedTexts : undefined,
                        }),
                    });

                    // 检查响应状态（如处理会员额度用尽）
                    if (!response.ok) {
                        const errBody = await response.json().catch(() => ({}));
                        if (errBody.limitReached) {
                            setMessages(prev => [
                                ...prev,
                                { role: 'assistant', content: `You've used all ${errBody.dailyLimit} messages for today! Come back tomorrow, or upgrade your plan for unlimited messages. 💜` },
                            ]);
                            return;
                        }
                        throw new Error(errBody.error || `Error (${response.status})`);
                    }

                    // 检查由后端危机检测器触发的安全模式头
                    if (response.headers.get('X-Safe-Mode') === 'true' && onSafeModeTrigger) {
                        onSafeModeTrigger(convId);
                    }

                    const reader = response.body?.getReader();
                    if (!reader) throw new Error('No response body');

                    const decoder = new TextDecoder();
                    let started = assistantText.length > 0;
                    const CHUNK_TIMEOUT = 45_000; // 单个块的最长等待时间

                    // ✅ 流式读取循环：逐块接收文本并实时上屏
                    while (true) {
                        const { value, done } = await readWithTimeout(reader, CHUNK_TIMEOUT);
                        if (done) break;

                        const chunk = decoder.decode(value, { stream: true });
                        if (!chunk) continue;

                        // 第一次收到流块时，在 UI 中插入 AI 气泡占位
                        if (!bubbleInserted) {
                            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
                            bubbleInserted = true;
                        }

                        assistantText += chunk;

                        if (!started && assistantText.trim().length > 0) {
                            started = true;
                            setIsLoading(false); // 收到首字节，隐藏思考动画
                        }

                        // 高频实时刷新 AI 回复气泡
                        setMessages(prev => {
                            const copy = [...prev];
                            const lastIndex = copy.length - 1;
                            if (copy[lastIndex]?.role === 'assistant') {
                                copy[lastIndex] = { ...copy[lastIndex], content: assistantText };
                            }
                            return copy;
                        });
                    }

                    // 刷新解码器缓冲区，解决可能存在的宽字节（中文）截断渲染问题
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

                    break; // 成功跑通流，退出重试循环

                } catch (streamError) {
                    // 核心重连逻辑：如果是网络错误且未达重试上限，则记录当前已生成的文本并等待恢复
                    if (isNetworkError(streamError) && attempt < MAX_RETRIES) {
                        attempt++;
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

                        await waitForNetwork(); // 等待 navigator.onLine 为 true
                        await new Promise(r => setTimeout(r, 2000)); // 稳定缓冲

                        setMessages(prev => {
                            const copy = [...prev];
                            const lastIndex = copy.length - 1;
                            if (copy[lastIndex]?.role === 'assistant') {
                                copy[lastIndex] = { ...copy[lastIndex], content: assistantText };
                            }
                            return copy;
                        });

                        setIsLoading(true);
                        continue;
                    }
                    throw streamError;
                }
            }

            // 8. 结束操作：将完整的 AI 回复持久化到数据库
            if (assistantText.trim()) {
                fetch(`/api/conversations/${convId}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ role: 'assistant', content: assistantText }),
                }).catch(err => console.error('Failed to save AI response:', err));

                // 如果开启了语音模式，调用语音合成引擎
                if (isVoice && speak) speak(assistantText);
            }

            /**
             * 标题异步刷新：
             * 由于后端在对话中通过 AI 异步生成摘要（Summarize）来得出标题，
             * 这里分时执行多次检查，确保侧边栏的对话标题能及时同步更新。
             */
            const refreshTitle = async () => {
                try {
                    const convResp = await fetch(`/api/conversations/${convId}?userId=${userId}`);
                    if (convResp.ok) {
                        const updatedConv = await convResp.json();
                        if (updatedConv.title && updatedConv.title !== convId.slice(0, 20)) {
                            updateConversationTitle(convId, updatedConv.title);
                        }
                    }
                } catch (err) { /* ignore */ }
            };
            setTimeout(refreshTitle, 1000);
            setTimeout(refreshTitle, 4000);
            setTimeout(refreshTitle, 8000);

        } catch (error) {
            console.error('Critical messaging error:', error);
            const errMsg = error instanceof Error ? error.message : 'Unknown error';
            setMessages(prev => {
                const copy = [...prev];
                const lastIndex = copy.length - 1;
                // 如果对话卡在一半，保留已生成的内容并提示用户重试
                if (copy[lastIndex]?.role === 'assistant' && copy[lastIndex].content.trim()) {
                    copy[lastIndex] = {
                        ...copy[lastIndex],
                        content: copy[lastIndex].content + `\n\n⚠️ *Connection lost. Please send your message again. (连接丢失，请尝试重新发送已保存的消息)*`,
                    };
                    return copy;
                }
                return [...prev, { role: 'assistant', content: `Sorry, something went wrong: ${errMsg}` }];
            });
        } finally {
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

