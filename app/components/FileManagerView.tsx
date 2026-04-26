'use client';

import { useState, useEffect, useCallback } from 'react';

// 本地渲染所需的底层数据契约定义
interface UserFile {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  createdAt: string;
}

/**
 * 助手工具：将字节单位转化为带有量级的可读容量体积
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 助手工具：根据文件类型分配相应的图案
 */
function getFileIcon(type: string, name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (type.startsWith('image/')) return '🖼️';
  if (['pdf'].includes(ext)) return '📄';
  if (['doc', 'docx'].includes(ext)) return '📝';
  if (['ppt', 'pptx'].includes(ext)) return '📊';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return '📈';
  if (['txt', 'md', 'json'].includes(ext)) return '📃';
  return '📎';
}

/**
 * 组件：用户私人文件保险箱 (FileManagerView)
 * 作用：在一个抽屉或模态框中，展示用户丢给 AI 的所有历史文件清单。
 * 核心机制：允许用户直接预览原始文件并进行物理删除操作。通过组件内部直接对接 /api/users/[userId]/files 的 REST 接口操作。
 */
export default function FileManagerView({ userId }: { userId: string }) {
  const [files, setFiles] = useState<UserFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');

  // 动作控制器：网络异步拉取属于该用户的所有文件
  const fetchFiles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/users/${userId}/files`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []); // 装填弹药：放入 state
      }
    } catch (err) {
      console.error('Failed to fetch files:', err);
      setError('Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // 生命周期：一挂载组件就开始抽查文件列表
  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  /**
   * 破坏性操作控制器：云端硬删除
   * 采用防手滑机制（原生 confirm 拦截），以及物理级接口销毁。
   * 如果后端返回 ok，立刻从当前的 React State 中过滤掉此文件，做到无感剔除。
   */
  const handleDelete = async (fileId: string) => {
    if (!confirm('Delete this file? This cannot be undone.')) return;
    setDeleting(fileId);
    try {
      const res = await fetch(`/api/users/${userId}/files?fileId=${fileId}`, { method: 'DELETE' });
      if (res.ok) {
        // UI 乐观回退：立刻过滤掉刚删除的对象
        setFiles(prev => prev.filter(f => f.id !== fileId));
      } else {
        setError('Failed to delete file');
      }
    } catch {
      setError('Failed to delete file');
    } finally {
      setDeleting(null);
    }
  };

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  // 异步缓冲态：提供友好的紫圈加载转动
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <div className="w-6 h-6 border-2 border-purple-300 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-neutral-400">Loading files...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 警告灯版块 */}
      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Storage summary (顶栏概览：显示已经吃掉的空间和文件总量) */}
      <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/30">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
              {files.length} file{files.length !== 1 ? 's' : ''}
            </div>
            <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
              Total: {formatFileSize(totalSize)}
            </div>
          </div>
          <div className="text-2xl opacity-60">📁</div>
        </div>
      </div>

      {/* File list (主列表区：为空时的插画，以及渲染行向排列项) */}
      {files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-neutral-400 dark:text-neutral-500">
          <span className="text-3xl opacity-50">📂</span>
          <span className="text-sm">No files uploaded yet</span>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-white/5 border border-neutral-100 dark:border-neutral-700 hover:border-purple-200 dark:hover:border-purple-700/50 transition-all duration-200"
            >
              {/* 文件表情包 */}
              <div className="w-9 h-9 rounded-lg bg-neutral-50 dark:bg-white/10 flex items-center justify-center shrink-0">
                <span className="text-base">{getFileIcon(file.type, file.name)}</span>
              </div>
              {/* 标题体 */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-neutral-700 dark:text-neutral-200 truncate">
                  {file.name}
                </div>
                <div className="text-xs text-neutral-400 dark:text-neutral-500">
                  {formatFileSize(file.size)} · {new Date(file.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {/* Download (打开外链) */}
                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                  title="Download"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </a>
                {/* Delete (投掷删除请求，如果当前文件正在处于删除进度条，则锁住按钮防止狂按) */}
                <button
                  onClick={() => handleDelete(file.id)}
                  disabled={deleting === file.id}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                  title="Delete"
                >
                  {deleting === file.id ? (
                    <div className="w-4 h-4 border-2 border-red-300 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
