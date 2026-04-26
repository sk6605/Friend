import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// 引用主题上下文：用于获取当前的主题状态（黑暗/白天模式）以及切换主题的方法
import { useTheme } from '@/app/context/ThemeContext';

/**
 * 组件：AiAvatarToggle
 * 作用：这是一个展示 AI 头像并允许用户通过点击切换系统主题（明/暗模式）的交互式组件。
 * 引用层级：通常被放置在全局导航栏 (Navbar) 或 Header 中，作为用户全局操作入口。
 * 
 * @param {string} persona - AI 的性格/角色名称，缺省值为 'default'。决定头像的配色及面部配件（如腮红、眼镜）。
 * @returns {JSX.Element} 返回一个包含帧动画(framer-motion)的 SVG 头像，点击触发主题切换。
 */
export default function AiAvatarToggle({ persona = 'default' }: { persona?: string }) {
    // 从全局上下文中获取 isDark (布尔值，是否黑暗模式) 和 toggle (切换黑暗模式的函数)
    const { isDark, toggle } = useTheme();
    
    // 初始化本地状态：isHovered 用于记录鼠标是否悬停在组件上，控制悬浮动画（如眼睛微调、形体变大）
    const [isHovered, setIsHovered] = useState(false);

    /**
     * 函数：handleToggle
     * 作用：处理点击事件。
     * 调用时机：当用户点击外层包裹的 div 区域时触发。
     * 功能：调用从 context 获取的 toggle 方法真正切换系统明/暗主题。
     */
    const handleToggle = () => {
        toggle();
    };

    /**
     * 函数：getPersonaConfig（AI 视觉性格档案库）
     * 作用：这是一个映射工厂函数，根据获取到的字符串决定这个 AI 应该渲染什么颜色、发什么光、戴什么配件。
     * 调用时机：每次组件渲染时，用于计算当前 UI 需要的一套样式变量。
     * 
     * @param {string} p - 传入的原生性格参数串
     * @returns {Object} 返回带有包含光/暗双色系统的配置对象
     */
    const getPersonaConfig = (p: string) => {
        const config = {
            default: { // Balanced Lumi：默认均衡型性格（金黄色系）
                light: { body: "#FEF08A", glow: "rgba(250, 204, 21, 0.5)", eyeStroke: "#854D0E", accessory: null },
                dark: { body: "#4C1D95", glow: "rgba(124, 58, 237, 0.4)", eyeStroke: "#A78BFA", accessory: null }
            },
            gentle: { // Soft, pinkish, warm：温柔型性格（粉色系，带腮红）
                light: { body: "#FBCFE8", glow: "rgba(244, 114, 182, 0.5)", eyeStroke: "#831843", accessory: 'blush' },
                dark: { body: "#701A75", glow: "rgba(192, 38, 211, 0.4)", eyeStroke: "#F0ABFC", accessory: 'blush' }
            },
            witty: { // Energetic, orange/amber：幽默型性格（橙色系，带坏笑嘴角）
                light: { body: "#FDBA74", glow: "rgba(249, 115, 22, 0.5)", eyeStroke: "#7C2D12", accessory: 'smirk' },
                dark: { body: "#9A3412", glow: "rgba(234, 88, 12, 0.4)", eyeStroke: "#FDBA74", accessory: 'smirk' }
            },
            mentor: { // Calm, teal/blue, academic：导师型性格（青绿色系，戴学霸眼镜）
                light: { body: "#99F6E4", glow: "rgba(20, 184, 166, 0.5)", eyeStroke: "#134E4A", accessory: 'glasses' },
                dark: { body: "#115E59", glow: "rgba(13, 148, 136, 0.4)", eyeStroke: "#5EEAD4", accessory: 'glasses' }
            },
            chill: { // Relaxed, mint/green：慵懒型性格（薄荷绿，半闭眼）
                light: { body: "#A7F3D0", glow: "rgba(16, 185, 129, 0.5)", eyeStroke: "#064E3B", accessory: 'chillEyes' },
                dark: { body: "#065F46", glow: "rgba(4, 120, 87, 0.4)", eyeStroke: "#6EE7B7", accessory: 'chillEyes' }
            }
        };
        // 归一化提取：将传入的 p 转换成全小写，如果不在配置中，则回退保底策略 'default'
        const key = Object.keys(config).includes(p.toLowerCase()) ? p.toLowerCase() as keyof typeof config : 'default';
        return config[key];
    };

    // 获取当前组件要求的全套样式配置
    const personaStyle = getPersonaConfig(persona);
    // 根据当前全局是否是黑夜模式(isDark)，选择读取光亮组还是暗组配色
    const currentStyle = isDark ? personaStyle.dark : personaStyle.light;

    return (
        // 最外层容器：负责监听用户的点击 (onClick) 及悬浮事件 (onMouseEnter/Leave) 以变动状态
        <div
            className="flex flex-col items-center justify-center cursor-pointer group"
            onClick={handleToggle}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            title="Click for surprise"
        >
            {/* 悬浮容器：使用 framer-motion 实现基础的持续呼吸漂浮特效 */}
            <motion.div
                className="relative w-16 h-16 flex items-center justify-center"
                // 赋予小球持续的上下悬浮“呼吸感”
                animate={{
                    y: [0, -6, 0], // y轴位移，保持活力悬浮 
                    scale: isHovered ? 1.05 : 1 // hover 时立刻触发放大 5% 的效果反馈
                }}
                transition={{
                    duration: 3, // 保持活力的呼吸速率，每 3 秒完成一次周期
                    repeat: Infinity, // 无限次循环动画
                    ease: "easeInOut" // 两端平滑缓动函数
                }}
            >
                {/* AI 身体背景光晕层：底层动态光晕效果 */}
                <motion.div
                    className="absolute inset-0 rounded-full blur-md"
                    animate={{
                        backgroundColor: currentStyle.glow, // 结合环境模式使用不同的环境光晕色
                        scale: [1, 1.2, 1], // 光晕扩大收缩的生命感特效
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />

                {/* AI 本体 (SVG 图形层)：实际展现颜文字或面部的绘图区域 */}
                <svg viewBox="0 0 100 100" className="relative z-10 w-14 h-14 drop-shadow-lg">
                    {/* 小圆脸材质：这是 AI 的主要躯体，颜色由当前样式的主体颜色决定 */}
                    <motion.circle
                        cx="50" cy="50" r="45"
                        animate={{
                            fill: currentStyle.body,
                        }}
                        transition={{ duration: 0.5 }}
                    />

                    {/* 眼睛组：控制眼睛及配件的一个动态分组 */}
                    <motion.g
                        animate={{
                            y: isHovered ? -2 : 0 // 在 Hover 状态时，面部特征整体上移 2px，拟态“抬头”或者“惊讶”的表情
                        }}
                    >
                        {/* 左眼/脸颊/配件组合 */}
                        <motion.path
                            animate={{
                                // 利用 pathData (d) 值，如果是慵懒风画弧线，否则画极小的二次贝塞尔圆点当眼球
                                d: personaStyle.light.accessory === 'chillEyes'
                                    ? "M 28 48 Q 34 46 40 48" // 慵懒半闭眼
                                    : "M 32 45 Q 32 45.01 32 45.02", // 使用 Q 曲线模拟圆点，避免和 A 曲线之间的插值导致 SVG 崩溃
                                stroke: currentStyle.eyeStroke, // 绘制线条颜色
                                strokeWidth: personaStyle.light.accessory === 'chillEyes' ? 5 : 8,
                                strokeLinecap: "round" // 给画笔加圆润线头
                            }}
                            fill="transparent"
                            transition={{ duration: 0.3 }}
                        />
                        {/* 右眼逻辑与左眼相同 */}
                        <motion.path
                            animate={{
                                d: personaStyle.light.accessory === 'chillEyes'
                                    ? "M 60 48 Q 66 46 72 48"
                                    : "M 68 45 Q 68 45.01 68 45.02", // 使用 Q 曲线模拟圆点，防止 framer motion 报错 Arc flag error
                                stroke: currentStyle.eyeStroke,
                                strokeWidth: personaStyle.light.accessory === 'chillEyes' ? 5 : 8,
                                strokeLinecap: "round"
                            }}
                            fill="transparent"
                            transition={{ duration: 0.3 }}
                        />

                        {/* AnimatePresence：在此树内控制组件挂载卸载时的进入和离开动画 */}
                        {/* 特殊性格配件 (亮色和暗色模式都显示，为了区分性格) */}
                        <AnimatePresence>
                            {/* 温柔性格专属：粉红腮红效果 */}
                            {personaStyle.light.accessory === 'blush' && (
                                <motion.g initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }}>
                                    <ellipse cx="28" cy="55" rx="6" ry="3" fill="#E11D48" className="blur-[1px]" />
                                    <ellipse cx="72" cy="55" rx="6" ry="3" fill="#E11D48" className="blur-[1px]" />
                                </motion.g>
                            )}

                            {/* 幽默性格专属：带有一点弯曲的坏笑嘴角 */}
                            {personaStyle.light.accessory === 'smirk' && (
                                <motion.path
                                    initial={{ opacity: 0, pathLength: 0 }}
                                    animate={{ opacity: 1, pathLength: 1 }}
                                    exit={{ opacity: 0 }}
                                    d="M 42 58 Q 55 65 62 52"
                                    stroke={currentStyle.eyeStroke}
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    fill="transparent"
                                />
                            )}

                            {/* 导师性格专属：一副黑平框眼镜 */}
                            {personaStyle.light.accessory === 'glasses' && (
                                <motion.g initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                    {/* 左镜框：绘制一个带有弧形矩形的圆角框 */}
                                    <rect x="22" y="38" width="22" height="14" rx="3" stroke={currentStyle.eyeStroke} strokeWidth="3" fill="transparent" />
                                    {/* 右镜框 */}
                                    <rect x="56" y="38" width="22" height="14" rx="3" stroke={currentStyle.eyeStroke} strokeWidth="3" fill="transparent" />
                                    {/* 鼻梁支撑架 */}
                                    <path d="M 44 45 Q 50 42 56 45" stroke={currentStyle.eyeStroke} strokeWidth="3" fill="transparent" />
                                </motion.g>
                            )}
                        </AnimatePresence>
                    </motion.g>
                </svg>
            </motion.div>
        </div>
    );
}

