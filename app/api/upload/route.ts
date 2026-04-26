import { NextRequest } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
// 自定义库：抽取包括 pdf, docx 等混合格式文件的纯文本供 AI 阅读
import { extractTextFromFile } from '@/app/lib/fileExtractor';
// 自定义库：上传二进流文件到 Cloudflare R2 对象存储的 SDK 封装
import { uploadToR2 } from '@/app/lib/r2';
// 数据库 ORM 实例
import { prisma } from '@/app/lib/db';

// --- 全局默认限制配置，如果用户未登录或数据库里未配其高级计划上限，将回退保底使用这些常量 (10MB, 最多 2 个文件) ---
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const DEFAULT_MAX_FILES = 2;

// --- 文件 MIME Type 与可用拓展名对照白名单，用于安全过滤不允许的执行文件 ---
const ALLOWED_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  'text/markdown': ['.md'],
  'application/json': ['.json'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
};

/**
 * 助手函数：isAllowedType (文件类型校验)
 * 作用：双层保险，既验证浏览器上报的 mimeType 是否在字典里，也交叉比对后缀名是不是对应的后缀名。
 * @param {string} mimeType 浏览器发请求附带的文件格式协议字
 * @param {string} fileName 原始文件的名字（用于抽取后缀名）
 * @returns {boolean} 是否准允上传该文件
 */
function isAllowedType(mimeType: string, fileName: string): boolean {
  const ext = path.extname(fileName).toLowerCase();
  // 命中严格的协议字典
  if (ALLOWED_TYPES[mimeType]) return true;
  // 回退：如果遇到某些特例如 application/octet-stream，只要后缀名属于咱们定义的后缀池，也放行
  const allExts = Object.values(ALLOWED_TYPES).flat();
  return allExts.includes(ext);
}

/**
 * API Route：上传文件通用接口 (App Router 模式下的 POST Handlers)
 * 路由：[POST] /api/upload
 * 作用：
 * 1. 接收前端打包发来的 FormData 中的多张文件流
 * 2. 检查用户所购会员计划，阻拦体积/数量超标及不支持后缀
 * 3. 针对非图片类稳定文件进行服务器中转下的文本提取（用来喂给大模型）
 * 4. 推送到 Cloudflare R2 云端做永久安全归档存储，返回公网直链 URL 及抽取出的内文文本
 * 5. 登记一条该操作记录录入 DB
 */
export async function POST(req: NextRequest) {
  try {
    // 解析前端多部分表单传送数据（multipart/form-data）
    const formData = await req.formData();
    // 强制断言拿去同名键 'files' 数组里的内容结构作为标准 File 数组
    const files = formData.getAll('files') as File[];
    // 获取传入的附带主键
    const userId = (formData.get('userId') as string) || null;

    // 获取并设置当前用户的 Plan 限制
    let maxFileSize = DEFAULT_MAX_FILE_SIZE;
    let maxFiles = DEFAULT_MAX_FILES;

    if (userId) {
      // 数据库查询：获取用户的订阅计划连带其权限详情 (内包含定制的 maxFileSizeMB 字段等)
      const subscription = await prisma.subscription.findUnique({
        where: { userId },
        include: { plan: true },
      });
      if (subscription?.plan) {
        // 解构自定义兆数并转换回字节数
        maxFileSize = (subscription.plan.maxFileSizeMB || 10) * 1024 * 1024;
        maxFiles = subscription.plan.maxFileUploads || 2;
      }
    }

    // 边界条件判断：没有挂带文件实体的空上传
    if (!files || files.length === 0) {
      return Response.json({ error: 'No files uploaded' }, { status: 400 });
    }

    // 边界条件判断：上传文件个数超标
    if (files.length > maxFiles) {
      return Response.json(
        { error: `Too many files. Your current plan allows maximum ${maxFiles} files per upload.` },
        { status: 400 }
      );
    }

    /** 
     * 一重循环卡点：集中前置校验逻辑 
     * 之所以先对数组全盘扫描，原因是防止上传 1张正确图片+1张含毒图片 的情况造成只过滤一张而把毒放过了
     */
    for (const file of files) {
      // 单文件容量超标
      if (file.size > maxFileSize) {
        // 根据数值动态选择单位以用于向客户端呈现友好的错误消息
        const sizeMsg = maxFileSize >= 1024 * 1024
          ? `${maxFileSize / (1024 * 1024)} MB`
          : `${Math.round(maxFileSize / 1024)} KB`;
        return Response.json(
          { error: `File "${file.name}" exceeds your plan's ${sizeMsg} size limit.` },
          { status: 400 }
        );
      }
      // 单文件类型违规
      if (!isAllowedType(file.type, file.name)) {
        return Response.json(
          { error: `File type not allowed: "${file.name}". Accepted: PDF, DOCX, PPT/PPTX, XLS/XLSX, TXT, CSV, MD, JSON, PNG, JPG, GIF, WebP.` },
          { status: 400 }
        );
      }
    }

    // 初始化聚合结果响应表
    const results: { url: string; name: string; size: number; type: string; r2Key: string; extractedText?: string }[] = [];

    // 开始逐一处理通过校验的文件流
    for (const file of files) {
      // 将底层的 Node ArrayBuffer 解构包裹为服务端可操作的 Buffer 流
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // 从原始文件名里提取并且清洗拓展名，避免中文字符导致文件系统无法落写
      const ext = path.extname(file.name).toLowerCase().replace(/[^a-z0-9.]/g, '');
      // 为这个文件新赋予一段 16 字节的安全随机 16 进制名称用作 UUID
      const uniqueName = `${crypto.randomBytes(16).toString('hex')}${ext}`;

      // ─── Text extraction for documents (文稿文字提炼处理) ───
      const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext);
      let extractedText: string | undefined; // 作为可选响应结果返回

      // 如果不是图片，极大概率是纯文本或 Office 类型（因前置已做了被允许类型校验），尝试对文件执行内容剥离
      if (!isImage) {
        // Vercel Serverless 环境下只能往 /tmp 内写运行时零时文件
        const tmpDir = '/tmp/uploads';
        if (!fs.existsSync(tmpDir)) {
          // 确保父目录存在，不存则建
          fs.mkdirSync(tmpDir, { recursive: true });
        }
        const tmpPath = path.join(tmpDir, uniqueName);
        try {
          // 在节点内部落地文件 (落文件是由于很多外部解析器譬如 pdfjs / docx 只支持阅读具体盘上的 fs路径，而不支持直接阅读 Memory Buffer)
          fs.writeFileSync(tmpPath, buffer);
          // 调用内部封装的核心转换服务，将内容吐为供大语言模型（LLM）所能消化的长串字符串
          extractedText = await extractTextFromFile(tmpPath, file.name);
        } catch (e) {
          // 分析出错不必阻断文件上云存储的流程
          console.error(`Text extraction failed for ${file.name}:`, e);
        } finally {
          // 操作收尾安全机制：无论提报抽文字成功与否，将占用磁盘的临时文件销毁，防止发生空间滥用崩溃
          try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
        }
      }

      // ─── Upload to Cloudflare R2 for persistent storage (推送数据至对象储存池) ───
      const r2Key = `uploads/${uniqueName}`;
      // 调用封装过的 R2 AWS S3 API 句柄接口上传 buffer 流
      const r2Url = await uploadToR2(r2Key, buffer, file.type || 'application/octet-stream');

      // 将文件详情推入返回队列
      results.push({
        url: r2Url,
        name: file.name,
        size: file.size,
        type: file.type,
        r2Key,
        extractedText,
      });

      // 插入一条历史记录到 MySQL 用户数据库表中（如果客户端发送时附带了操作人ID）
      if (userId) {
        // 对插入做异步不阻断 (catch errors)，加速前端感受到 Response 返回的过程
        prisma.userFile.create({
          data: {
            userId,
            name: file.name,
            url: r2Url,
            r2Key, // 存储 R2Key 方便日后触发 R2 删除桶口 API 需要用唯一文件把柄识别
            size: file.size,
            type: file.type,
          },
        }).catch(err => console.error('Failed to save file record:', err));
      }
    }

    // 将解析出的长报文，以及 R2 CDN 直链交给前端渲染聊天气泡或发给大模型
    return Response.json({ files: results });
  } catch (error) {
    console.error('Upload error:', error);
    return Response.json(
      { error: 'File upload failed' },
      { status: 500 }
    );
  }
}
