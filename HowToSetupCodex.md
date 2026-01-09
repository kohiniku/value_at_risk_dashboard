## 1. ShadcnMCPのインストール
```
# npx の一時キャッシュを削除
rm -rf ~/.npm/_npx

# npm キャッシュもクリア
npm cache clean --force

# ShadcnMCPをインストール
npx shadcn@latest mcp init --client codex
```

## 2. Codexの設定ファイルを更新
```
hide_agent_reasoning = true
network_access = true

notify = ["bash", "-lc", "afplay /System/Library/Sounds/Ping.aiff"]
model = "gpt-5-codex"
model_reasoning_effort = "high"

web_search_request = true

[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp@latest"]
startup_timeout_sec = 30

[mcp_servers.serena]
command = "uvx"
args = [
        "--from", "git+https://github.com/oraios/serena",
        "serena", "start-mcp-server",
        "--context", "codex",
        "--enable-web-dashboard=false",
        "--project", "."
]
startup_timeout_sec = 30

[mcp_servers.playwright]
command = "npx"
args = ["-y", "@playwright/mcp@latest"]
startup_timeout_sec = 30

[mcp_servers.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem"]
startup_timeout_sec = 30

[mcp_servers.shadcn]
command = "npx"
args = ["shadcn@latest", "mcp"]
startup_timeout_sec = 30

[mcp_servers.chrome-devtools]
command = "npx"
args = ["chrome-devtools-mcp@latest"]
startup_timeout_sec = 30

[mcp_servers.next-devtools]
command = "npx"
args = ["-y", "next-devtools-mcp@latest"]
startup_timeout_sec = 30

[mcp_servers.ultracite]
command = "npx"
args = [
  "-y",
  "mcp-remote",
  "https://www.ultracite.ai/api/mcp/mcp"
]
startup_timeout_sec = 30
```