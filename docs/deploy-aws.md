# 把 Friend AI 部署到 AWS

> 适用对象：第一次接手部署的人。照着从上往下做一遍即可上线；之后 push 到 `main` 就会自动更新，不需要 SSH。

## 0. 架构总览

```
                    push main
GitHub ─────────────┬──────────────────────────────┐
                    ▼                              ▼
             Amplify（前端）                GitHub Actions
   https://main.xxxx.amplifyapp.com         （OIDC 换临时权限）
          │  页面：Amplify 自己渲染                 │ SSM Run Command
          │  /api/*：服务端转发 ──http──┐           ▼
          │                             └──────► EC2（后端）
浏览器 ──https──┘                                 nginx :80 → Next.js :3000（pm2）
                                                  node-cron 定时任务
                                                   │            │ 每次部署拉取 .env
                                                   ▼            ▼
                                             RDS（MySQL）    S3（私有 bucket，放后端 env）
```

| AWS 服务 | 作用 | 对应的 repo 文件 |
|---|---|---|
| **Amplify** | 构建并托管前端；把 `/api/*` 转发到 EC2 | `amplify.yml`、`next.config.ts`（`rewrites`） |
| **EC2** | 跑后端 API 与 cron | `deploy/bootstrap-ec2.sh`、`deploy/deploy.sh`、`deploy/rollback.sh`、`deploy/ecosystem.config.cjs`、`deploy/nginx.conf` |
| **RDS** | MySQL 数据库 | `prisma/schema.prisma` |
| **S3** | 存放后端 env 文件（唯一一份 secret 来源） | `.env.example`（变量清单） |
| GitHub Actions | push 后自动部署 EC2 | `.github/workflows/deploy-backend.yml` |

**几条约定：**
- 所有 secret 只存在 S3 那一个 env 文件里。Amplify 只有一个非机密变量 `BACKEND_URL`。repo 里不放任何 secret。
- EC2、RDS、S3 放在**同一个区域**（本项目用 `ap-southeast-5` 马来西亚）。Amplify 可以在任何区域。
- 只要求读者会用 AWS Console，命令都可以直接复制。

---

## 1. 准备 env 文件（从 Vercel 导出）

在你自己电脑上的 repo 目录里执行：

```bash
npx vercel link                                          # 选择 friend-ai 项目
npx vercel env pull .env.aws --environment=production    # 导出到 .env.aws（已被 .gitignore 忽略）
```

打开 `.env.aws`，对照 `.env.example` 修改：

1. **删除**所有 `VERCEL_` 开头的行（那些是 Vercel 自己注入的变量）。
2. **检查空值**：在 Vercel 上被标记为 *Sensitive* 的变量，导出后值是空的。这些要去原来的服务后台重新拿（例如 OpenAI、Stripe 控制台）。
3. **`DATABASE_URL`**：先记下旧值（第 2 步搬数据要用），等第 2 步建好 RDS 后换成 RDS 的连接串。
4. **`CRON_SECRET`**：**换一个新的随机值**（`openssl rand -hex 32`），因为旧值曾经提交到 git 历史里。
5. **加一行** `ENABLE_CRON=true`。
6. `STRIPE_WEBHOOK_SECRET` 先保留，第 8 步会换。

> ⚠️ 这个文件里全是 secret：不要贴进聊天、工单或截图，上传 S3 后就从本机删掉。

---

## 2. RDS（MySQL）

1. **先建两个安全组**（EC2 → Security Groups，用默认 VPC）：
   - `friend-ec2-sg`：入站只开 **HTTP 80**，来源 `0.0.0.0/0`（不开 22，因为用 SSM 登录）。
   - `friend-rds-sg`：入站 **MySQL/Aurora 3306**，来源选 **`friend-ec2-sg`**（选安全组，不要填 IP）。
2. RDS → Create database：
   - Engine：**MySQL 8.x**；模板：Free tier 或 Production；实例：`db.t4g.micro` 起步。
   - 设定主用户名和密码（记在密码管理器里）。
   - **Public access：No**；VPC security group：`friend-rds-sg`。
   - Initial database name：例如 `friend`。
   - 开启自动备份。
3. 建好后复制 **Endpoint**，回到 `.env.aws`，把 `DATABASE_URL` 换成：
   `mysql` 协议 + 用户名 + 密码 + Endpoint + 端口 `3306` + 库名，末尾加 `?connection_limit=10`（格式和旧值一样，只是 host 换了）。
4. 如果之后连不上，并且报错和 TLS/SSL 有关，说明这个 RDS 参数组强制要求 TLS，需要按 Prisma 的 MySQL SSL 参数补上 RDS CA。部署后实测确认。

> 旧库的数据迁移放在第 5 步，因为 RDS 不对公网开放，只能从 EC2 上操作。

---

## 3. S3（存放后端 env）

1. S3 → Create bucket：
   - 名字：全球唯一，例如 `friend-ai-env-<随机后缀>`；区域与 EC2 相同。
   - **Block all public access：保持勾选**。
   - **Bucket Versioning：Enable**（env 改坏了可以回到旧版本）。
   - 加密：默认的 SSE-S3 即可（不要选 KMS 自建 key，否则 EC2 还要额外的 `kms:Decrypt` 权限）。
2. 上传 env 文件（对象 key 固定用 `production.env`）：
   ```bash
   aws s3 cp .env.aws s3://<bucket>/production.env
   rm .env.aws
   ```
   不想用 CLI 的话，也可以在 Console 里 Upload。记住完整路径 `s3://<bucket>/production.env`，后面称为 **ENV_S3_URI**。

---

## 4. IAM：EC2 的 role

IAM → Roles → Create role → Trusted entity 选 **AWS service → EC2**：

1. 挂上托管策略 **`AmazonSSMManagedInstanceCore`**（让 SSM 能管理这台机器）。
2. 再加一个 inline policy，**只允许读那一个 env 文件**：
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::<bucket>/production.env"
       }
     ]
   }
   ```
3. 命名为 `friend-ec2-role`。

---

## 5. EC2

### 5.1 开机器

EC2 → Launch instance：
- AMI：**Ubuntu Server 24.04 LTS**；类型：**t3.small** 或同级（≥ 2 GB 内存）；磁盘 ≥ 20 GB。
- Key pair：可以不选（用 SSM 登录）。
- Security group：`friend-ec2-sg`。
- Advanced details → IAM instance profile：`friend-ec2-role`。
- Tags：**`App` = `friend-api`**。自动部署靠这个 tag 找机器，**必须正好一台**。

启动后：EC2 → Elastic IPs → Allocate → Associate 到这台实例。**记下这个 IP**，后面称为 **EC2_IP**。

> 已经有一台旧 EC2？可以直接复用：补挂 `friend-ec2-role`（Actions → Security → Modify IAM role）、补上 tag、在安全组里关掉 22。如果之前手动用 pm2 启动过，先执行 `pm2 delete all`。

### 5.2 登录

EC2 → 选中实例 → **Connect → Session Manager → Connect**，然后切换到 ubuntu 用户：

```bash
sudo su - ubuntu
```

### 5.3 拉代码

- **公开 repo**：
  ```bash
  git clone https://github.com/sk6605/Friend.git ~/friend-repo
  ```
- **私有 repo**（用只读 deploy key）：
  ```bash
  ssh-keygen -t ed25519 -f ~/.ssh/friend_deploy -N ""
  cat ~/.ssh/friend_deploy.pub     # 复制到 GitHub repo → Settings → Deploy keys → Add（不要勾 write）
  printf 'Host github.com\n  IdentityFile ~/.ssh/friend_deploy\n  StrictHostKeyChecking accept-new\n' >> ~/.ssh/config
  git clone git@github.com:sk6605/Friend.git ~/friend-repo
  ```

### 5.4（可选）把旧数据库的数据搬到 RDS

旧库要能从 EC2 连到。如果连不到，就在能同时连到两边的机器上做。

```bash
sudo apt-get install -y mysql-client
mysqldump -h <旧host> -P <旧port> -u <旧user> -p --single-transaction --set-gtid-purged=OFF <旧库名> > dump.sql
mysql -h <RDS endpoint> -u <RDS user> -p <库名> < dump.sql
rm dump.sql
```

### 5.5 一键初始化

```bash
bash ~/friend-repo/deploy/bootstrap-ec2.sh s3://<bucket>/production.env
```

脚本会依次完成：加 2G swap → 安装 Node 22 / nginx / AWS CLI / pm2 → 写入本机配置 `~/.friend-deploy.conf` → **检查能否读取 S3 上的 env 文件** → 配置 nginx → 首次部署 → 设置 pm2 开机自启。

完成后检查：

```bash
curl -I http://localhost/          # 应返回 200
pm2 status                         # friend-api 状态应为 online
```

在自己电脑上打开 `http://EC2_IP/`，应该能看到页面。

### 5.6 EC2 上的目录结构

```
~/friend-repo/                    git 仓库（只用来拉代码）
~/friend-releases/<时间>-<sha>/    每次部署生成一个 release（含 .env、node_modules、.next）
~/friend-current -> 当前 release   pm2 从这里启动
~/.friend-deploy.conf             ENV_S3_URI 与区域（不进 git）
```

---

## 6. Amplify（前端）

1. Amplify → Create new app → **GitHub** → 授权 → 选 `sk6605/Friend`，分支 `main`。
2. 构建设置会自动读取 repo 里的 `amplify.yml`，不用改。
3. **Environment variables 只加一个**：
   | Key | Value |
   |---|---|
   | `BACKEND_URL` | `http://EC2_IP`（结尾不加 `/`） |

   **不要**把 S3 env 文件里的任何变量加进来，尤其是 `UPSTASH_*`。加了会让限流在 Amplify 和 EC2 各算一次。
4. Save and deploy。完成后得到 `https://main.xxxx.amplifyapp.com`。

> `BACKEND_URL` 是在 **build 时**写进转发规则的。改了它之后，必须在 Amplify 上 **Redeploy** 才会生效。

---

## 7. GitHub Actions 自动部署 EC2

### 7.1 在 AWS 里信任 GitHub（只做一次）

IAM → Identity providers → Add provider：
- Type：**OpenID Connect**
- Provider URL：`https://token.actions.githubusercontent.com`
- Audience：`sts.amazonaws.com`

### 7.2 建 deploy role

IAM → Roles → Create role → **Web identity** → 选刚才的 provider、audience `sts.amazonaws.com`，GitHub organization 填 `sk6605`、repository 填 `Friend`、branch 填 `main`。

生成的 trust policy 应该类似下面这样，**`sub` 必须锁定到 main 分支**：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Federated": "arn:aws:iam::<账号ID>:oidc-provider/token.actions.githubusercontent.com" },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:sk6605/Friend:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

权限加一个 inline policy：只能对带 `App=friend-api` tag 的实例执行 `AWS-RunShellScript`。

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "ssm:SendCommand",
      "Resource": "arn:aws:ssm:<区域>::document/AWS-RunShellScript"
    },
    {
      "Effect": "Allow",
      "Action": "ssm:SendCommand",
      "Resource": "arn:aws:ec2:<区域>:<账号ID>:instance/*",
      "Condition": { "StringLike": { "ssm:resourceTag/App": ["friend-api"] } }
    },
    {
      "Effect": "Allow",
      "Action": ["ssm:GetCommandInvocation", "ec2:DescribeInstances"],
      "Resource": "*"
    }
  ]
}
```

命名为 `github-deploy-friend`，复制它的 **ARN**。

### 7.3 在 GitHub 上设置变量

GitHub repo → Settings → Secrets and variables → Actions → **Variables** 页签（不是 Secrets，这两个值不是机密）：

| Name | Value |
|---|---|
| `AWS_REGION` | `ap-southeast-5` |
| `AWS_DEPLOY_ROLE_ARN` | 上一步复制的 role ARN |

### 7.4 测试

GitHub → Actions → **Deploy backend (EC2)** → Run workflow。日志里会打印 EC2 上 `deploy.sh` 的完整输出，最后一行是 `Status: Success`。

---

## 8. 第三方服务切换

1. **Stripe**：Dashboard → Developers → Webhooks，新增 endpoint
   `https://main.xxxx.amplifyapp.com/api/subscription/webhook`，事件和旧 endpoint 保持一致。
   把新的 **Signing secret** 更新到 S3 的 env 文件（见第 10 节「改 env」），然后删掉旧的 Vercel endpoint。
2. **Vercel**：确认 AWS 这边跑通后，把 Vercel 项目暂停或删除。否则 Vercel 的 cron 会继续跑，还会和 EC2 抢着发通知。
3. **cron**：不需要外部服务，EC2 上的 node-cron 会自己触发（时区 `Asia/Kuala_Lumpur`，在 `deploy/ecosystem.config.cjs` 里设置）。

---

## 9. 上线验收清单

- [ ] 打开 Amplify 网址，注册或登录成功。
- [ ] 发一条消息，回复是**一段段流出来的**，不是等很久后一次性出现。
- [ ] 上传一个大于 10 MB 的文件，成功。
- [ ] Stripe Dashboard → 对新 endpoint 点 *Send test webhook*，返回 2xx。
- [ ] EC2：`pm2 logs friend-api` 能看到 API 请求。
- [ ] EC2：等到下一个 cron 时间点，能看到 `[Cron] ...` 日志，并且时间是马来西亚时间。
- [ ] 限流按**用户真实 IP** 计算：在日志里确认 `x-forwarded-for` 的第一个 IP 不是 Amplify 的 IP。
- [ ] 改一行代码 push 到 main，Amplify 和 Actions 都变绿，线上能看到改动。

---

## 10. 日常操作

| 要做的事 | 怎么做 |
|---|---|
| 发布新代码 | push 到 `main`。前端由 Amplify 自动更新，后端由 Actions 自动更新 |
| 改 env（加 key、换密码） | 下载 → 修改 → 上传覆盖 `s3://<bucket>/production.env` → GitHub Actions 手动 **Run workflow** |
| 回滚后端代码 | Session Manager 登录 → `sudo su - ubuntu` → `bash ~/friend-current/deploy/rollback.sh`（只回滚代码，**不回滚数据库 schema**） |
| 回滚前端 | Amplify → Deployments → 选旧版本 → Redeploy this version |
| 回滚 env | S3 → 对象 → Versions → 恢复旧版本 → 重新 Run workflow |
| 看后端日志 | `pm2 logs friend-api` / `pm2 status` |
| 手动部署（不经过 Actions） | `git -C ~/friend-repo fetch origin main && git -C ~/friend-repo reset --hard origin/main && bash ~/friend-repo/deploy/deploy.sh` |
| 改数据库 schema | 改 `prisma/schema.prisma` 后 push，`deploy.sh` 会执行 `prisma db push`。**会丢数据的变更会直接失败**，这是故意的，需要人工评估后处理 |

---

## 11. 故障排查

| 现象 | 可能原因 |
|---|---|
| Amplify build 失败：`Missing credentials` 之类 | 某个模块在顶层就读取了 secret。客户端要在函数里按需创建（参考 `app/lib/cron/runDailySummary.ts` 的 `getOpenAIClient`） |
| Amplify 部署失败：`RequestEntityTooLargeException` | Amplify 的 SSR 产物上限是 50 MB，依赖太大 |
| 页面正常，但 `/api` 全部 404 或超时 | `BACKEND_URL` 没设或填错（改完要 Redeploy）；EC2 安全组没开 80；EC2 上 `pm2 status` 不是 online |
| Actions：`Not authorized to perform sts:AssumeRoleWithWebIdentity` | trust policy 里的 `sub` 和 repo、分支对不上 |
| Actions：期望 1 台实例，实际 0 台 | 实例没有 `App=friend-api` tag，或者没在运行 |
| Actions 一直 Pending，或者报 `InvalidInstanceId` | EC2 没挂 `friend-ec2-role`，SSM Agent 没上线（Systems Manager → Fleet Manager 里看不到这台机器） |
| `deploy.sh` 在 [2/7] 失败 | EC2 role 没有该 S3 对象的 `s3:GetObject`，或者 `~/.friend-deploy.conf` 里的路径错了 |
| `deploy.sh` 在 [4/7] 被 Killed | 内存不够，确认 swap 已开启（`swapon --show`），或者换大一点的实例 |
| `deploy.sh` 在 [5/7] 失败 | 连不上 RDS（检查安全组）、需要 TLS，或者 schema 变更会丢数据 |
| SSH 进去后 nano 打不开（`xterm-ghostty`） | 执行 `export TERM=xterm-256color`（bootstrap 已经写进 `~/.bashrc`） |

---

## 12. 已知限制（上线前要知道）

- **Amplify → EC2 这一段走 HTTP，没有加密**。浏览器到 Amplify 是 HTTPS。正式商用前建议买个域名，给 EC2 加 HTTPS（例如 nginx + Let's Encrypt），再把 `BACKEND_URL` 改成 https。
- **EC2 的 80 端口对公网开放**，知道 IP 的人可以绕过 Amplify 直接请求 API。
- **流式回复和大文件上传都经过 Amplify 转发**。Amplify 计算层的超时和请求大小上限需要按第 9 节实测。如果撑不住，备选方案是让前端直接请求 EC2 的 HTTPS 域名（需要域名），或者整个 app 都放在 EC2 上。
- **pm2 是单进程**，每次 reload 会有几秒不可用。
