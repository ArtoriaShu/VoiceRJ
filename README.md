# 本地 DLsite 音声库

私有部署的本地音声文件索引与播放器。当前完成了第一阶段的可运行基础：密码访问、SQLite 持久化、媒体目录管理、增量扫描、作品检索、受认证保护的 HTTP Range 音频播放，以及紧凑的响应式媒体库界面。

## 已实现

- Argon2id 密码哈希、HttpOnly 会话 Cookie、登录限流、会话过期和写操作 CSRF 校验。
- 管理员添加服务器端目录；后端验证目录存在且可读。
- 基于 `relative path + size + mtime` 的增量扫描；消失文件会标记为 `missing`，不会删除历史记录。
- 自动从文件夹名或路径识别 `RJ\d+`；支持 MP3、FLAC、WAV、M4A、AAC、OGG、OPUS。
- 已登录用户才可访问媒体接口；文件路径经过根目录边界校验；音频接口支持 HTTP Range。
- 媒体库搜索、作品抽屉、自然排序音轨和固定底部播放器。

## 后续阶段

- ffprobe 元数据、FFmpeg 兼容转码缓存、播放队列/进度持久化。
- LRC/VTT/SRT 解析、同步歌词与 Document Picture-in-Picture 歌词窗。
- DLsite 公开元数据/本地封面缓存，以及 ASMR.one 中文标题适配器与手动标题覆盖。
- 定时扫描、目录编辑界面、备份恢复、集成与浏览器端到端测试。

## 本地运行

需要 Node.js 22+ 与 pnpm 9+。

```bash
cp .env.example .env
# 编辑 .env，并设置 ACCESS_PASSWORD
corepack enable
pnpm install
pnpm db:migrate
pnpm dev
```

打开 `http://localhost:5173`。第一次登录使用 `.env` 的 `ACCESS_PASSWORD`；该密码只会在首次启动时写入 Argon2id 哈希。之后如需重置密码，需要在维护窗口中按数据库运维流程更新哈希，不能仅修改环境变量。`123` 仅适用于本地测试，部署前务必替换为强密码。

## Docker 部署

1. `cp .env.example .env` 并设置强密码。
2. 编辑 [docker-compose.yml](docker-compose.yml)，将 `/absolute/path/to/your/audio` 改成宿主机真实目录。
3. 运行 `docker compose up -d --build`。
4. 打开 `http://server:3001`。容器会提供已构建的前端和 API；生产环境仍应使用 Nginx/Caddy 在前方提供 HTTPS。

媒体目录必须只读挂载；数据库位于命名 volume `newvoice-data`。备份时停止服务并备份该 volume 中的 `library.sqlite`，恢复时还原该文件后再启动。升级前同样先备份数据库，并运行新的迁移。

## 安全和合规

- 不要把媒体目录映射到公开 Web 根目录。
- 在生产环境启用 HTTPS，`NODE_ENV=production` 时会话 Cookie 会带 `Secure`。
- 外部元数据同步（后续阶段）仅请求公开资料，不绕过登录、付费、DRM 或反爬限制；部署者须遵守来源站点条款。
