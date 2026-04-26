// 引入由于兼容 S3 而可以直接用的亚马逊 AWS 客户端工具类
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

/**
 * Cloudflare R2 对象存储工具包 (Storage Utility)
 *
 * 作用：利用 AWS SDK S3 兼容层，打通与 Cloudflare R2 取代 Amazon S3 以节约出口带路计费，
 * 被作为全站图片与用户上传物料归档的总仓库调用。
 * 我们内部默认桶（Bucket）名叫： friend-ai
 *
 * 前置必须提供的环境变量:
 * - R2_ACCOUNT_ID: Cloudflare 你的控制台主账号 ID
 * - R2_ACCESS_KEY_ID: 为此特约创建的 R2 API 的读写权限 key
 * - R2_SECRET_ACCESS_KEY: 对应的权限 Secret key
 * - R2_PUBLIC_URL: 你在 R2 面板绑定的公开公网域名（如 r2.my-domain.com 或者自带的 dev）
 */

const R2_BUCKET = 'friend-ai';

// 实例化常驻全局唯一的 S3 连接客户端
const r2Client = new S3Client({
  region: 'auto', // R2 会自动寻址全球最近的 CDN 节点无需指定固定区
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, // 取代 AWS endpoint
  credentials: {
    // 防止不配置造成报错的容错
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

/**
 * 封装工具函数：直接把二进制文件切片推上 R2 云端
 *
 * @param {string} key 在这个桶内文件的相对路径坐标，比如 "avatars/my-avatar_abc123.jpg"
 * @param {Buffer} body 具体被传递进网络管子的实体文件流本身
 * @param {string} contentType 原生 MIME 声明（确保图片传上去能被浏览器阅读呈现而不是变成强行下载）
 * @returns {Promise<string>} 被存入后能从外网读到的 HTTP 完整 URL 路径
 */
export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  // 利用 SDK 的指令机制 (PutObject) 一次性发射上传动作
  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key, // 即存入的文件名字
      Body: body, // 取代纯文件传输直接挂文件流体
      ContentType: contentType, // 重要：缺此浏览器打开图会变成静默下载
    })
  );

  // 上抛完之后，开始拼接能从网页直接看这图的公用前缀链接返回给数据库或前端
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (publicUrl) {
    return `${publicUrl}/${key}`; // 如果自己配了子域名就用优雅的自己的
  }

  // 兜底机制：使用提供商本身附带的笨重地址返回。前提要开发者将 R2 本配置改成了允许公网穿透访问
  return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`;
}

/**
 * 封装工具函数：从 R2 干净地将指定节点移除
 * 作用：用作空间打理，比如前端覆盖新头像时可以传 key 把老头像删了腾出账单空间
 *
 * @param {string} key 在这个桶内存着的真实节点相对路径，如 "avatars/my-avatar_abc123.jpg"
 */
export async function deleteFromR2(key: string): Promise<void> {
  // 无声息的 Delete 掉，如不存在也大概率返回成功
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    })
  );
}

/**
 * 封装工具函数：拆解机，从数据库的一长段 URL 扒回 R2 储存真实的主键 key
 * 作用：有些时候数据库里存的是完整的 http//xxx.com/avatars/file.png。
 * 但我们要动用删除接口只认 `avatars/file.png` 这个主键。我们就用它做切取。
 *
 * @param {string} url 数据库拉出来的对象外网连接
 * @returns {string | null} 干净利落的核心 key 或是空。
 */
export function getR2KeyFromUrl(url: string): string | null {
  if (!url) return null;

  // 兼顾历史包保底逻辑：如果是早起本地挂的 /uploads/ 假链接就无视它（由于不是对象库，不支持 SDK 操作）
  if (url.startsWith('/uploads/')) return null;

  try {
    const publicUrl = process.env.R2_PUBLIC_URL;
    // 如果完美符合自定前缀大条件，切掉它加杠的地方，剩下的就是纯 key 主键
    if (publicUrl && url.startsWith(publicUrl)) {
      return url.slice(publicUrl.length + 1); // +1 为了去掉了那根 "/"
    }

    // 后备切割判断：拿 R2 原始未加皮的重路径去进行切割，利用正则反向捕获 .com/friend-ai/ 后面的第一组元素作为返回
    const r2Pattern = /r2\.cloudflarestorage\.com\/friend-ai\/(.+)$/;
    const match = url.match(r2Pattern);
    if (match) return match[1];

    return null;
  } catch {
    return null; // 切割发生溢出报废即抛弃抛给上一级处理
  }
}
