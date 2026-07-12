# Yuzu Transfer Server

柚子快传后端，基于 Go 实现，负责：

- 验证码生成与设备 ID 映射
- 在线状态查询
- WebSocket signaling 转发
- STUN / TURN 配置下发
- TURN 中转服务启动

## 技术栈

- Go
- Gorilla WebSocket
- Pion TURN

## 目录说明

- `main.go`：程序入口
- `internal/config/`：配置读取
- `internal/httpapi/`：HTTP 接口与 CORS 处理
- `internal/store/`：配对码、在线状态、signaling 转发
- `internal/turnservice/`：TURN 服务启动逻辑

## 默认行为

### 验证码

- 验证码长度：4 位
- 同一个 `deviceId` 默认复用已有验证码
- 只有 `forceRefresh=true` 时才会重新生成

### TURN / 中转

- 默认监听端口：`3478`
- 同时监听 UDP / TCP
- 默认 Relay 文件限制：`50 MB`

## 环境变量

可配置项如下：

```env
APP_PORT=8080
TURN_PORT=3478
TURN_PUBLIC_IP=你的公网IP或域名解析IP
TURN_REALM=yuzu-transfer
TURN_USERNAME=yuzu
TURN_PASSWORD=yuzu-turn
TURN_BIND_HOST=0.0.0.0
```

说明：

- `APP_PORT`：HTTP API 监听端口
- `TURN_PORT`：TURN 监听端口
- `TURN_PUBLIC_IP`：TURN 对外宣告地址；不传时后端会尝试自动探测本机 IPv4
- `TURN_REALM` / `TURN_USERNAME` / `TURN_PASSWORD`：TURN 鉴权参数
- `TURN_BIND_HOST`：TURN 中继绑定地址

## 本地启动

进入后端目录：

```bash
cd server
```

安装依赖并运行：

```bash
go run .
```

或构建后运行：

```bash
go build -o yuzu-transfer .
./yuzu-transfer
```

## HTTP / WebSocket 接口

### `GET /health`

健康检查，返回 `204 No Content`。

### `GET /api/config`

返回前端需要的 RTC 配置：

- `relayMaxFileSize`
- `iceServers`

### `POST /api/pairings`

创建或复用验证码。

请求体：

```json
{
  "deviceId": "device_xxx",
  "forceRefresh": false
}
```

### `POST /api/pairings/exchange`

使用验证码换取目标设备 ID。

请求体：

```json
{
  "code": "1234",
  "deviceId": "device_xxx"
}
```

### `POST /api/presence`

批量查询设备在线状态。

请求体：

```json
{
  "deviceIds": ["device_a", "device_b"]
}
```

### `GET /api/signaling?deviceId=xxx`

WebSocket signaling 通道。

用途：

- offer / answer / ICE candidate 转发
- 设备上线后 presence 可见

## CORS

当前 HTTP API 对外返回：

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Headers: Content-Type, Authorization`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`

## 生产部署

项目根目录提供后端发布脚本：

```bash
bash scripts/release_backend.sh
```

当前部署约定：

- 后端目录：`/opt/www/kc`
- 可执行文件名：`kc`
- 启动脚本：`start.sh`
- 进程管理：PM2

`start.sh` 示例：

```bash
pm2 start /opt/www/kc/kc --name kc
```

## 运行要求

生产环境需要确保以下端口可访问：

- HTTP API 端口（如 `8080` 或当前配置值）
- TURN 端口（默认 `3478`，UDP / TCP）

如果走反向代理，还需要正确透传：

- `Host`
- `X-Forwarded-Host`

这样 `/api/config` 才能给前端返回正确的 ICE 主机名。
