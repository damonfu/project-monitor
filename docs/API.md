# Project Monitor API 文档

## 概述

Project Monitor API 是一个基于 Cloudflare Workers 的项目监控平台后端服务。

- **Base URL**: `https://project-monitor-api.inmanfu.workers.dev`
- **版本**: 2.0.0
- **认证**: Bearer Token (部分接口需要)

## 认证

部分接口需要通过 `Authorization` 头部传递 token:

```
Authorization: Bearer <your-token>
```

## API 端点

### 1. 基础信息

#### GET /
服务健康检查

**响应示例:**
```json
{
  "name": "Project Monitor API",
  "version": "2.0.0",
  "status": "healthy",
  "features": {
    "kv": true,
    "scan": true,
    "alerts": true,
    "projectManagement": true
  },
  "timestamp": "2026-03-04T14:00:00.000Z"
}
```

#### GET /api
获取所有可用端点

---

### 2. 项目管理

#### GET /api/projects
获取所有项目列表

**响应示例:**
```json
{
  "lastScanTime": "2026-03-04T10:00:00.000Z",
  "totalProjects": 5,
  "projectsWithChangesToday": 1,
  "dirtyProjects": 4,
  "errorProjects": 0,
  "projects": [
    {
      "id": "ai-middleware",
      "name": "ai-middleware",
      "path": "/Users/inman/Codes/gitee/ai-middleware",
      "remote": "git@gitee.com:fujianguo/ai-middleware.git",
      "branch": "master",
      "lastCommitTime": "2026-03-04 10:44:53 +0800",
      "lastCommitHash": "32bf4f9",
      "lastCommitMessage": "chat/completions优化&增加session会话管理",
      "hasChangesToday": true,
      "isDirty": true,
      "status": "dirty",
      "todayCommitCount": 2,
      "weekCommitCount": 10,
      "recentCommits": [...]
    }
  ]
}
```

#### GET /api/projects/:name
获取指定项目详情

**参数:**
- `name` - 项目名称

**响应示例:**
```json
{
  "id": "ai-middleware",
  "name": "ai-middleware",
  "path": "/Users/inman/Codes/gitee/ai-middleware",
  "remote": "git@gitee.com:fujianguo/ai-middleware.git",
  "branch": "master",
  "lastCommitTime": "2026-03-04 10:44:53 +0800",
  "lastCommitHash": "32bf4f9",
  "lastCommitMessage": "chat/completions优化&增加session会话管理",
  "hasChangesToday": true,
  "isDirty": true,
  "status": "dirty",
  "todayCommitCount": 2,
  "weekCommitCount": 10,
  "recentCommits": [...]
}
```

#### POST /api/projects/:name/group
设置项目分组

**请求体:**
```json
{
  "group": "backend"
}
```

**响应示例:**
```json
{
  "success": true,
  "message": "Project 'ai-middleware' added to group 'backend'",
  "config": {
    "name": "ai-middleware",
    "group": "backend",
    "favorite": false,
    "alertConfig": {},
    "createdAt": "2026-03-04T14:00:00.000Z",
    "updatedAt": "2026-03-04T14:00:00.000Z"
  }
}
```

#### POST /api/projects/:name/favorite
设置项目收藏状态

**请求体:**
```json
{
  "favorite": true
}
```

**响应示例:**
```json
{
  "success": true,
  "message": "Project 'ai-middleware' added to favorites",
  "config": {
    "name": "ai-middleware",
    "group": "backend",
    "favorite": true,
    "alertConfig": {},
    "createdAt": "2026-03-04T14:00:00.000Z",
    "updatedAt": "2026-03-04T14:00:00.000Z"
  }
}
```

#### GET /api/projects/:name/config
获取项目配置

#### PUT /api/projects/:name/config
更新项目配置

**请求体:**
```json
{
  "group": "frontend",
  "favorite": false,
  "alertConfig": {
    "uncommittedThreshold": 48,
    "inactiveThreshold": 14,
    "enabled": true
  }
}
```

#### GET /api/projects/groups
获取所有项目分组

**响应示例:**
```json
{
  "groups": {
    "backend": [...],
    "frontend": [...]
  },
  "favorites": [...],
  "ungrouped": [...],
  "totalProjects": 5
}
```

---

### 3. 告警系统

#### GET /api/alerts
获取所有告警

**响应示例:**
```json
{
  "alerts": [
    {
      "id": "uncommitted-ai-middleware-1709539200000",
      "type": "uncommitted",
      "projectName": "ai-middleware",
      "projectPath": "/Users/inman/Codes/gitee/ai-middleware",
      "severity": "warning",
      "message": "项目 ai-middleware 有未提交的更改已超过 26 小时",
      "details": {
        "uncommittedDuration": 26,
        "lastCommitTime": "2026-03-03 12:00:00 +0800"
      },
      "status": "active",
      "createdAt": "2026-03-04T14:00:00.000Z",
      "updatedAt": "2026-03-04T14:00:00.000Z"
    }
  ],
  "total": 5,
  "active": 2,
  "acknowledged": 1,
  "ignored": 2
}
```

#### GET /api/alerts/active
获取活跃告警

#### GET /api/alerts/:id
获取指定告警详情

#### POST /api/alerts/:id/acknowledge
确认告警

**请求体:**
```json
{
  "acknowledgedBy": "inman"
}
```

**响应示例:**
```json
{
  "success": true,
  "message": "Alert acknowledged",
  "alert": {
    "id": "uncommitted-ai-middleware-1709539200000",
    "type": "uncommitted",
    "status": "acknowledged",
    "acknowledgedAt": "2026-03-04T14:00:00.000Z",
    "acknowledgedBy": "inman",
    ...
  }
}
```

#### POST /api/alerts/:id/ignore
忽略告警

**请求体:**
```json
{
  "ignoredBy": "inman",
  "reason": "正在开发中，临时忽略"
}
```

#### GET /api/alerts/config
获取告警配置

**响应示例:**
```json
{
  "uncommittedThreshold": 24,
  "inactiveThreshold": 7,
  "enabled": true,
  "feishuNotification": false
}
```

#### PUT /api/alerts/config
更新告警配置

**请求体:**
```json
{
  "uncommittedThreshold": 48,
  "inactiveThreshold": 14,
  "enabled": true,
  "feishuNotification": true,
  "feishuWebhook": "https://open.feishu.cn/..."
}
```

---

### 4. 扫描系统

#### GET /api/scan/latest
获取最新扫描数据

#### GET /api/scan/status
获取扫描系统状态

**响应示例:**
```json
{
  "configured": true,
  "lastScanTime": "2026-03-04T14:00:00.000Z",
  "totalProjects": 5,
  "activeAlerts": 2,
  "alertConfig": {
    "uncommittedThreshold": 24,
    "inactiveThreshold": 7,
    "enabled": true,
    "feishuNotification": false
  }
}
```

#### POST /api/scan
提交扫描数据 (外部扫描器调用)

**请求头:**
```
Authorization: Bearer <scan-token>
```

**请求体:**
```json
{
  "lastScanTime": "2026-03-04T14:00:00.000Z",
  "projects": [...],
  "scanDuration": 1500,
  "scanPath": "~/Codes"
}
```

**响应示例:**
```json
{
  "success": true,
  "message": "Scan data received and processed",
  "scanTime": "2026-03-04T14:00:00.000Z",
  "alertsGenerated": 1,
  "alerts": [
    {
      "id": "uncommitted-ai-middleware-1709539200000",
      "type": "uncommitted",
      "severity": "warning",
      "message": "项目 ai-middleware 有未提交的更改已超过 26 小时",
      ...
    }
  ]
}
```

#### POST /api/scan/trigger
触发告警检查

---

### 5. 快照

#### GET /api/snapshots
获取可用快照日期

#### GET /api/snapshots/:date
获取指定日期快照

---

### 6. 报告

#### GET /api/reports
获取报告列表

#### GET /api/reports/:date
获取报告内容 (Markdown)

#### GET /api/reports/:date/json
获取报告内容 (JSON)

---

## 告警规则

### 规则 1: 未提交告警
当项目有未提交的更改且超过阈值时间时触发。

- **默认阈值**: 24 小时
- **可配置**: 通过 `uncommittedThreshold` 设置

### 规则 2: 不活跃告警
当项目超过指定天数没有提交时触发。

- **默认阈值**: 7 天
- **可配置**: 通过 `inactiveThreshold` 设置

---

## 本地扫描

### 安装依赖

```bash
cd ~/Codes/project-monitor
npm install
```

### 配置

1. 复制配置示例文件:
```bash
cp worker/config.example.json worker/config.json
```

2. 编辑 `worker/config.json`，填入实际配置:
```json
{
  "apiUrl": "https://project-monitor-api.inmanfu.workers.dev",
  "scanToken": "your-scan-token",
  "feishuNotify": true,
  "feishuWebhook": "https://open.feishu.cn/..."
}
```

3. 设置环境变量:
```bash
export SCAN_TOKEN=your-scan-token
```

### 运行扫描

```bash
# 手动运行
npx tsx scripts/scan-and-push.ts

# 启用飞书通知
npx tsx scripts/scan-and-push.ts --notify

# 或设置环境变量
export FEISHU_NOTIFY=true
npx tsx scripts/scan-and-push.ts
```

### 设置定时任务

编辑 crontab:
```bash
crontab -e
```

添加以下行 (每 30 分钟执行):
```
*/30 * * * * cd ~/Codes/project-monitor && npx tsx scripts/scan-and-push.ts >> ~/logs/scan.log 2>&1
```

---

## 部署

### 1. 创建 KV Namespace

```bash
cd worker
wrangler kv:namespace create PROJECT_MONITOR
wrangler kv:namespace create PROJECT_MONITOR --preview
```

### 2. 更新 wrangler.toml

将 KV namespace ID 填入 `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "KV"
id = "YOUR_KV_NAMESPACE_ID"
preview_id = "YOUR_PREVIEW_KV_NAMESPACE_ID"
```

### 3. 设置 secrets

```bash
# 设置扫描 token
wrangler secret put SCAN_TOKEN
# 输入你的扫描 token

# (可选) 设置飞书 webhook
wrangler secret put FEISHU_WEBHOOK
# 输入你的飞书 webhook URL
```

### 4. 部署

```bash
npm run deploy
```

---

## 错误码

| 状态码 | 说明 |
|--------|------|
| 400 | 请求参数错误 |
| 401 | 未授权 (token 无效) |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
| 503 | 服务不可用 (KV 未配置) |

---

## Changelog

### v2.0.0 (2026-03-04)
- ✨ 新增告警系统 API
- ✨ 新增项目管理 API (分组、收藏)
- ✨ 新增扫描系统 API
- ✨ 支持 KV 持久化存储
- ✨ 支持飞书通知
- ⚠️  Breaking: 部分接口路径变更
