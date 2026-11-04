// pm2 进程配置（EC2 后端）。
// cwd 指向 ~/friend-current 这个 symlink：deploy.sh 切换 symlink 后 `pm2 startOrReload`
// 启动的就是新 release。Next.js 会自动读取 cwd 下的 .env（由 deploy.sh 从 S3 拉取）。
module.exports = {
  apps: [
    {
      name: 'friend-api',
      cwd: `${process.env.HOME}/friend-current`,
      script: 'node_modules/next/dist/bin/next',
      // 只监听本机，外部流量一律经 nginx（80）进来
      args: 'start -p 3000 -H 127.0.0.1',
      env: {
        NODE_ENV: 'production',
        // instrumentation.ts 的 cron 按服务器本地时间触发；EC2 默认 UTC，这里固定为马来西亚时间
        TZ: 'Asia/Kuala_Lumpur',
      },
      max_memory_restart: '1G',
    },
  ],
};
