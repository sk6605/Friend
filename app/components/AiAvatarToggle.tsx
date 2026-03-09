import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/app/context/ThemeContext';

export default function AiAvatarToggle({ persona = 'default' }: { persona?: string }) {
    const { isDark, toggle } = useTheme();
    const [isHovered, setIsHovered] = useState(false);

    // 点击时，先做动画，再切换主题
    const handleToggle = () => {
        toggle();
    };

    // --- Persona Visual Configurations ---
    const getPersonaConfig = (p: string) => {
        const config = {
            default: { // Balanced Lumi
                light: { body: "#FEF08A", glow: "rgba(250, 204, 21, 0.5)", eyeStroke: "#854D0E", accessory: null },
                dark: { body: "#4C1D95", glow: "rgba(124, 58, 237, 0.4)", eyeStroke: "#A78BFA", accessory: null }
            },
            gentle: { // Soft, pinkish, warm
                light: { body: "#FBCFE8", glow: "rgba(244, 114, 182, 0.5)", eyeStroke: "#831843", accessory: 'blush' },
                dark: { body: "#701A75", glow: "rgba(192, 38, 211, 0.4)", eyeStroke: "#F0ABFC", accessory: 'blush' }
            },
            witty: { // Energetic, orange/amber
                light: { body: "#FDBA74", glow: "rgba(249, 115, 22, 0.5)", eyeStroke: "#7C2D12", accessory: 'smirk' },
                dark: { body: "#9A3412", glow: "rgba(234, 88, 12, 0.4)", eyeStroke: "#FDBA74", accessory: 'smirk' }
            },
            mentor: { // Calm, teal/blue, academic
                light: { body: "#99F6E4", glow: "rgba(20, 184, 166, 0.5)", eyeStroke: "#134E4A", accessory: 'glasses' },
                dark: { body: "#115E59", glow: "rgba(13, 148, 136, 0.4)", eyeStroke: "#5EEAD4", accessory: 'glasses' }
            },
            chill: { // Relaxed, mint/green
                light: { body: "#A7F3D0", glow: "rgba(16, 185, 129, 0.5)", eyeStroke: "#064E3B", accessory: 'chillEyes' },
                dark: { body: "#065F46", glow: "rgba(4, 120, 87, 0.4)", eyeStroke: "#6EE7B7", accessory: 'chillEyes' }
            }
        };
        // Normalize persona key
        const key = Object.keys(config).includes(p.toLowerCase()) ? p.toLowerCase() as keyof typeof config : 'default';
        return config[key];
    };

    const personaStyle = getPersonaConfig(persona);
    const currentStyle = isDark ? personaStyle.dark : personaStyle.light;

    return (
        <div
            className="flex flex-col items-center justify-center cursor-pointer group"
            onClick={handleToggle}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            title="Click for surprise"
        >
            {/* 悬浮容器 */}
            <motion.div
                className="relative w-16 h-16 flex items-center justify-center"
                // 赋予小球持续的上下悬浮“呼吸感”
                animate={{
                    y: isDark ? [0, -2, 0] : [0, -6, 0], // 睡觉时悬浮幅度变小 
                    scale: isHovered && !isDark ? 1.05 : 1 // hover 时轻飘放大
                }}
                transition={{
                    duration: isDark ? 4 : 3, // 睡觉时呼吸变慢
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
            >
                {/* AI 身体背景光晕 */}
                <motion.div
                    className="absolute inset-0 rounded-full blur-md"
                    animate={{
                        backgroundColor: currentStyle.glow,
                        scale: isDark ? [1, 1.1, 1] : [1, 1.2, 1],
                    }}
                    transition={{ duration: isDark ? 4 : 2, repeat: Infinity, ease: "easeInOut" }}
                />

                {/* AI 本体 (SVG) */}
                <svg viewBox="0 0 100 100" className="relative z-10 w-14 h-14 drop-shadow-lg">
                    {/* 小圆脸材质 */}
                    <motion.circle
                        cx="50" cy="50" r="45"
                        animate={{
                            fill: currentStyle.body,
                        }}
                        transition={{ duration: 0.5 }}
                    />

                    {/* 眼睛组 */}
                    <motion.g
                        animate={{
                            y: isHovered && !isDark ? -2 : 0 // Hover时抬头看你
                        }}
                    >
                        {/* 左眼/脸颊/配件组合 */}
                        <motion.path
                            animate={{
                                d: isDark
                                    ? "M 30 50 Q 35 55 40 50"
                                    : personaStyle.light.accessory === 'chillEyes'
                                        ? "M 28 48 Q 34 46 40 48" // 慵懒半闭眼
                                        : "M 32 45 A 4 4 0 1 1 32 45.01",
                                stroke: currentStyle.eyeStroke,
                                strokeWidth: isDark ? 4 : (personaStyle.light.accessory === 'chillEyes' ? 5 : 8),
                                strokeLinecap: "round"
                            }}
                            fill="transparent"
                            transition={{ duration: 0.3 }}
                        />
                        {/* 右眼 */}
                        <motion.path
                            animate={{
                                d: isDark
                                    ? "M 60 50 Q 65 55 70 50" // 暗色模式两只眼睛都闭上
                                    : personaStyle.light.accessory === 'chillEyes'
                                        ? "M 60 48 Q 66 46 72 48"
                                        : "M 68 45 A 4 4 0 1 1 68 45.01",
                                stroke: currentStyle.eyeStroke,
                                strokeWidth: isDark ? 4 : (personaStyle.light.accessory === 'chillEyes' ? 5 : 8),
                                strokeLinecap: "round"
                            }}
                            fill="transparent"
                            transition={{ duration: 0.3 }}
                        />

                        {/* 特殊性格配件 (亮色和暗色模式都显示，为了区分性格) */}
                        <AnimatePresence>
                            {/* 温柔型：腮红 */}
                            {personaStyle.light.accessory === 'blush' && (
                                <motion.g initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }}>
                                    <ellipse cx="28" cy="55" rx="6" ry="3" fill="#E11D48" className="blur-[1px]" />
                                    <ellipse cx="72" cy="55" rx="6" ry="3" fill="#E11D48" className="blur-[1px]" />
                                </motion.g>
                            )}

                            {/* 幽默型：坏笑嘴角 */}
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

                            {/* 导师型：黑框眼镜 */}
                            {personaStyle.light.accessory === 'glasses' && (
                                <motion.g initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                    {/* 左镜框 */}
                                    <rect x="22" y="38" width="22" height="14" rx="3" stroke={currentStyle.eyeStroke} strokeWidth="3" fill="transparent" />
                                    {/* 右镜框 */}
                                    <rect x="56" y="38" width="22" height="14" rx="3" stroke={currentStyle.eyeStroke} strokeWidth="3" fill="transparent" />
                                    {/* 鼻梁架 */}
                                    <path d="M 44 45 Q 50 42 56 45" stroke={currentStyle.eyeStroke} strokeWidth="3" fill="transparent" />
                                </motion.g>
                            )}
                        </AnimatePresence>
                    </motion.g>

                    {/* 睡眠鼻涕泡 (仅在暗色模式下显示) */}
                    <AnimatePresence>
                        {isDark && (
                            <motion.circle
                                cx="45" cy="55" r="8"
                                fill="none"
                                stroke={currentStyle.eyeStroke}
                                strokeWidth="2"
                                style={{ transformOrigin: "45px 55px" }}
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{
                                    scale: [0.8, 1.4, 0.8],
                                    opacity: [0.4, 0.8, 0.4]
                                }}
                                exit={{ scale: 0, opacity: 0, transition: { duration: 0.2 } }}
                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                            />
                        )}
                    </AnimatePresence>
                </svg>

                {/* 熟睡的 Zzz 粒子效果 */}
                <AnimatePresence>
                    {isDark && (
                        <motion.div
                            className="absolute -top-4 -right-2 text-indigo-300 font-bold text-sm"
                            initial={{ opacity: 0, y: 10, scale: 0.5 }}
                            animate={{ opacity: [0, 1, 0], y: -20, scale: 1.2, x: 10 }}
                            transition={{ duration: 3, repeat: Infinity, ease: "easeOut", delay: 1 }}
                        >
                            Z
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

        </div>
    );
}
