# Cloudflare Worker 部署指南

## 功能说明

这是一个 API 代理服务，用于保护 OpenRouter API Key 不被暴露在前端代码中。

## 部署步骤

### 1. 安装 Wrangler CLI

```bash
npm install -g wrangler
```

### 2. 登录 Cloudflare

```bash
wrangler login
```

### 3. 进入 worker 目录

```bash
cd worker
```

### 4. 设置 API Key（环境变量）

```bash
wrangler secret put OPENROUTER_API_KEY
# 然后粘贴你的 OpenRouter API Key
```

### 5. 部署 Worker

```bash
wrangler deploy
```

### 6. 获取 Worker URL

部署成功后会显示类似：
```
https://redwisdom-api.你的账号.workers.dev
```

### 7. 更新前端配置

将 Worker URL 填入 `config.js` 或 `config.example.js` 中的 `WORKER_URL` 字段。

## 使用说明

Worker 会自动：
- 接收前端的聊天请求
- 从环境变量读取 API Key
- 代理请求到 OpenRouter
- 返回流式响应

API Key 存储在 Cloudflare 的环境变量中，前端代码中完全不包含敏感信息。
