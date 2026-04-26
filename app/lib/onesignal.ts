// 提前写入死码配置的 OneSignal 推送平台专属 App ID 项目名。
const ONESIGNAL_APP_ID = '81fa54b9-f9ca-4c1c-a0a1-28fe793571c5';

/**
 * 封装工具函数：请求 OneSignal 第三方平台发起移动端消息 Push 推送的 REST API 工具栈
 * 
 * 使用范围：通过发送 POST 指标给 OneSignal 处理中枢网关，触发对设备端的直接桌面横幅提示或移动端响铃播报（由用户授权即可）。
 * 定点机制：我们并非盲广播，而是依赖用户注册系统时附带绑定的 external_id (跟本系统数据库的 user.id 挂钩) 对点触达。
 * 
 * @param {string[]} userIds 需要接收该消息的目标用户标识符聚合列表（通常单发时填 1个 id即可）
 * @param {string} title 推送所展示的短标头信息（如：☀️早安）
 * @param {string} body 推送的实质消息段落字符串
 * @param {string} url 用户在外面接到弹窗点击通知条时打开项目时的深层链接，默认导流回主聊天房 '/chat'
 * @param {Date} [sendAfter] 锦上添花的预设时间戳（如存在则将通知留存在提供商数据库中等时间到再触发动作，不传则立刻马上送出去）
 * @returns {Promise<void>} 动作下放过程只抛错误日志不必回传复杂报文
 */
export async function sendPushNotification(
  userIds: string[],
  title: string,
  body: string,
  url = '/chat',
  sendAfter?: Date
): Promise<void> {

  // 从运行主环境取平台要求提供的服务端密匙
  const restApiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!restApiKey) {
    console.warn('ONESIGNAL_REST_API_KEY not set, skipping push'); // 防宕机无密码时跳出函数不发送
    return;
  }
  
  // 无视空包传递
  if (userIds.length === 0) return;

  // 根据 OneSignal 开发者文档定制化构造出发送主干实体结构 (Payload JSON)
  const payload: Record<string, unknown> = {
    app_id: ONESIGNAL_APP_ID,
    target_channel: 'push', // 只允许向 App Push 渠道发射广播而不仅是短邮/信道内建
    include_aliases: { external_id: userIds }, // 基于第三方别名的外部 id 作为唯一识别路由下发端口
    headings: { en: title }, // 设置英文或本地化推送主内容，统一放 default 'en' 即默认强制原样渲染不经过他们那儿的二重翻译机
    contents: { en: body },
    url, // 下拉菜单内含的跳转指令
  };

  // 如果业务内含预约发包则通过时间接口转化并挂接成字符串交送排量管理池
  if (sendAfter) {
    payload.send_after = sendAfter.toISOString();
  }

  // 利用系统的内建 fetch 工具直接朝远方挂链调用 REST 通道口，塞入所有配置以及强鉴权协议头
  const res = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${restApiKey}`, // Basic Auth 原则鉴权密令规范
    },
    body: JSON.stringify(payload), // 解析包体压缩至字符串传输出局内
  });

  // 如果收到了错误的响应代号（如网络阻断/或密钥失效）抓起错误给开发者警醒提示信息以免漏收
  if (!res.ok) {
    const err = await res.text();
    console.error('OneSignal push failed:', res.status, err);
  }
}
