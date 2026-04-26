'use client';

import { useState, useEffect } from 'react';

// === TypeScript 契约定义：限定返回给前端的用户业务信息应当包含哪些受控字段，避免 TS 乱点 ===
interface UserInfo {
  id: string; // 鉴权体系分配的主键 ID
  nickname: string; // 用户的称呼（常被 AI 用于问法中称名）
  aiName: string; // 用户为自己的这只数字伴侣起的名字（例：Lumi）
  language: string; // 指定的输出语种，控制 AI 回信的多语言模型
  profilePicture: string | null; // 头像链接（常来自 R2 对象云端直连）
  persona?: string; // 用户指定的 AI 人格偏好（例：严厉、温柔、傲娇）
  subscription?: { // （嵌写）高级付费用户订阅权证信息状态
    plan?: {
      name: string; // 在 stripe 上架购额套餐系统里的唯一名称
      displayName?: string; // 界面上显示的友好中文渲染名
    }
  } | null;
}

/**
 * React 客户端自定义钩子 Hook (CSR Only)
 * 作用：一键挂载至页面里，只要传入已鉴权的 userId，就能直接从后台全盘抓取用户详细配置，
 *      并封装成统一的 State 返回，组件只需关注使用解构数据。
 * 
 * @param {string | null} userId 传入登录后拿到的当前用户 ID，如果未登录直接打 null
 * @returns { userInfo, refetch } 提供带有强类型的包裹状态，以及一个用于让组件决定何时主动强制刷新的回调
 */
export function useUserInfo(userId: string | null) {
  // 定义内部响应式装载机 State，由于加载需要时间，起初为 null
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  /**
   * 拉取刷新内包函数
   * 触发点：可以主动调用进行脏数据清洗获取新数据，也会被 useEffect 包转自动触发。
   */
  const refetch = () => {
    // 拦截拦截：没有传入 userId 证明为游客态直接掐断网络连线请求
    if (!userId) return;
    
    // Call 统一收口接口获取
    fetch(`/api/users/${userId}`)
      .then(res => res.ok ? res.json() : null) // 规避抛错炸雷：如果非 200 号位即刻判死返回 null 不触发渲染异常
      .then(data => {
        if (data) setUserInfo(data); // 用服务器原封不动的打包替换掉组件级 State
      })
      .catch(() => { /* 静默吞错不报错 */ });
  };

  /**
   * 挂载监听系统池
   * 效应：当该 userId 被塞进来，或者是 userId 中途切换变了之后，此 effect 都会被触发让状态自己走一遍更新并重新 render
   */
  useEffect(() => {
    refetch();
  }, [userId]); // ← 这里的 userId 是一个订阅依赖。

  // 返回暴露给使用环境的只读数据，和修改权柄
  return { userInfo, refetch };
}
