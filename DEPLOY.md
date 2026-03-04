# Docker + Nginx 一键部署

## 1) 服务器准备
- 安装 Docker（含 `docker compose`）
- 开放端口（默认 `80`）

## 2) 一键部署
在项目根目录运行：

```bash
bash scripts/deploy.sh
```

默认会按前端域名 `https://contest.mareate.com` 生成 `FRONTEND_URL` 和 `CORS_ORIGINS`。

脚本会：
- 自动生成根目录 `.env`（如果不存在）
- 校验 SMTP（本项目仅支持邮箱魔法链接登录）
- 构建并启动 `mongo + backend + nginx`
- 等待健康检查通过

## 3) 首次部署推荐（带域名）
```bash
APP_HOST=contest.mareate.com \
APP_SCHEME=https \
APP_PORT=80 \
SMTP_USER=admin@example.com \
SMTP_PASSWORD='your-smtp-password' \
EMAIL_FROM='BusyBee <admin@example.com>' \
bash scripts/deploy.sh
```

## 4) 常用命令
```bash
docker compose ps
docker compose logs -f
docker compose restart
docker compose down
```

## 5) 重要说明
- 登录方式：仅魔法链接（无密码登录）
- 必须正确配置 SMTP，否则无法登录
- 如果已存在 `.env`，脚本会复用；需要重建时加 `--force-env`
