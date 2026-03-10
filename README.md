# Clawcase

Discover and reproduce real OpenClaw use cases.

## 启动

```bash
cd openclaw-usecase-hub
node server.js
```

默认地址：`http://localhost:8787`

## API

- `GET /api/health`
- `GET /api/usecases?q=关键词&tag=标签`
- `POST /api/usecases`

POST 示例：

```bash
curl -X POST http://localhost:8787/api/usecases \
  -H 'content-type: application/json' \
  -d '{
    "title":"Slack 每日 standup 自动汇总",
    "summary":"自动拉取团队消息并生成 standup 摘要",
    "problem":"跨时区 standup 信息分散难同步",
    "workflow":"1) 拉取消息 2) 聚类 3) 生成摘要",
    "reproPrompt":"你是 OpenClaw，读取 Slack 指定频道过去24小时消息...",
    "tools":"message, cron",
    "tags":"slack,automation"
  }'
```
