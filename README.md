# Yuzu Transfer Frontend

柚子快传前端，基于 React + TypeScript + Vite，实现设备配对、会话管理、WebRTC 文件/图片/文本传输、移动端与 PC 自适应界面。

## 技术栈

- React
- TypeScript
- Vite
- WebRTC DataChannel
- `lucide-react`

## 目录说明

- `src/`：前端源码
- `public/avatars/`：预设头像资源
- `scripts/release_frontend.sh`：前端发布脚本
- `.env.development`：开发环境变量
- `.env.production`：生产环境变量
- `server/`：Go 后端

## 环境变量

开发环境：

```env
VITE_SERVER_ORIGIN=/
VITE_PROXY_TARGET=http://192.168.31.139:8080
```

生产环境：

```env
VITE_SERVER_ORIGIN=https://kc.noondot.com
```

说明：

- `VITE_SERVER_ORIGIN`：前端请求 API 的基础地址
- `VITE_PROXY_TARGET`：本地开发时 Vite 代理到的后端地址

## 本地开发

安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

构建生产包：

```bash
npm run build
```

## 当前主要功能

- 固定验证码 / 手动刷新验证码
- 二维码扫码自动加入
- 会话列表、屏蔽、删除
- 文本、图片、文件传输
- 发送方 / 接收方双向进度显示
- 在线状态查询与自动刷新
- 网络变化后自动重连 signaling，并尝试恢复当前会话
- 中英文国际化
- 教程、设置、关于页面

## 与后端联调

前端依赖以下后端接口：

- `POST /api/pairings`
- `POST /api/pairings/exchange`
- `POST /api/presence`
- `GET /api/config`
- `GET /api/signaling?deviceId=xxx`（WebSocket）

同时依赖后端提供：

- STUN / TURN ICE 配置
- TURN 中转能力
- 配对码与设备 ID 映射

## 发布

项目已经提供前端发布脚本：

```bash
bash scripts/release_frontend.sh
```

当前脚本行为：

1. 本地执行 `npm run build`
2. 通过 SSH 把 `dist/` 上传到线上目录

当前生产部署目录：

```text
/opt/1panel/apps/openresty/openresty/www/sites/kc.noondot.com/index
```

## 线上地址

- 生产站点：[https://kc.noondot.com](https://kc.noondot.com)

## 注意事项

- 会话、验证码、设备 ID 当前仅保存在 `sessionStorage`
- 刷新验证码前，当前设备会复用已有验证码
- 图片 / 文件消息在页面刷新后会显示为已过期，不再可下载
- 实际传输优先走 P2P；无法直连时自动回退到 TURN 中转
