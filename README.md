# MCP FPK 打包服务器

[![Version](https://img.shields.io/npm/v/fnpackup-mcp-server.svg)](https://www.npmjs.com/package/fnpackup-mcp-server)
[![License](https://img.shields.io/npm/l/fnpackup-mcp-server.svg)](https://github.com/weiyvshan/fnpackup-mcp-server/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-brightgreen.svg)](https://nodejs.org/)

一个用于打包 fpk 应用程序的 MCP (Model Context Protocol) 服务器。AI agent 可以使用此工具帮助用户创建、编辑和打包 fpk 文件。

## 功能

### 应用管理
- 📦 列出所有应用
- ➕ 创建新应用（Native 或 Docker）
- 📥 导入现有 .fpk 文件
- 🔍 查看应用详情
- 🗑️ 删除应用

### 文件编辑
- 📁 列出目录结构
- 📖 读取文件内容
- ✏️ 写入/创建文件
- 🔄 智能编辑文件
- 🗑️ 删除文件/目录
- ⬆️ 上传本地文件

### 配置编辑
- ⚙️ 编辑 manifest 配置
- 🔐 编辑环境变量
- 🐳 编辑 Docker Compose

### 打包构建
- 📦 打包应用为 .fpk 文件

### 国际化
- 🌍 列出国际化文件
- ✏️ 编辑翻译内容

### 验证
- ✅ 验证应用配置

## 安装

### 方式 A：使用 npm（推荐）

```bash
npm install -g fnpackup-mcp-server
```

### 方式 B：使用 npx（无需全局安装）

```bash
npx fnpackup-mcp-server
```

### 方式 C：源码安装

```bash
git clone https://github.com/weiyvshan/fnpackup-mcp-server.git
cd fnpackup-mcp-server
npm install
npm run build
```

## 配置

### Claude Code

编辑 Claude Code 配置文件 `~/.claude/mcp.json`：

**全局安装时（推荐）**：

```json
{
  "mcpServers": {
    "fnpackup": {
      "command": "fnpackup-mcp-server",
      "env": {
        "PROJECTS_DIR": "C:\\path\\to\\fnpackup\\projects"
      }
    }
  }
}
```

**源码运行时（开发者）**：

```json
{
  "mcpServers": {
    "fnpackup": {
      "command": "node",
      "args": ["/absolute/path/to/fnpackup-mcp-server/dist/index.js"],
      "env": {
        "PROJECTS_DIR": "/path/to/fnpackup/projects"
      }
    }
  }
}
```

### Claude Desktop

编辑 Claude Desktop 配置文件：

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

添加以下配置：

```json
{
  "mcpServers": {
    "fnpackup": {
      "command": "fnpackup-mcp-server",
      "env": {
        "PROJECTS_DIR": "C:\\path\\to\\fnpackup\\projects"
      }
    }
  }
}
```

### 自定义项目目录

通过环境变量设置项目目录：

```json
{
  "mcpServers": {
    "fpk-packager": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "PROJECTS_DIR": "/path/to/your/projects"
      }
    }
  }
}
```

如果未设置，默认使用 `../projects/`（相对于 MCP 服务器的位置）。

## 使用示例

### 创建原生应用

```
1. 创建应用
create_application("my-app", "native", "我的第一个应用")

2. 查看结构
open_application("my-app")

3. 上传程序
upload_file("my-app", "C:\\local\\server.js", "app/server/server.js")

4. 编辑配置
edit_manifest("my-app", {
  "entry": "server.js",
  "port": 3000,
  "auto_start": "true"
})

5. 验证
validate_application("my-app")

6. 打包
build_fpk("my-app")
```

### 创建 Docker 应用

```
1. 创建应用
create_application("my-docker-app", "docker")

2. 编辑 Docker Compose
edit_docker_compose("my-docker-app", "version: '3'\nservices:\n  app:\n    image: nginx:alpine\n    ports:\n      - '80:80'")

3. 编辑配置
edit_manifest("my-docker-app", {
  "port": 80,
  "privileged": "false"
})

4. 打包
build_fpk("my-docker-app")
```

### 导入并修改

```
1. 导入 fpk
import_fpk("C:\\path\\to\\app.fpk", "imported-app")

2. 查看结构
open_application("imported-app")

3. 读取文件
read_file("imported-app", "app/server/config.js")

4. 编辑文件
edit_file("imported-app", "app/server/config.js", [
  { old_string: "PORT=3000", new_string: "PORT=8080" }
])

5. 重新打包
build_fpk("imported-app")
```

## FPK 应用结构

### Native 应用

```
my-app/
├── manifest              # 应用配置
└── app/
    ├── server/          # 服务端程序
    │   ├── server.js    # 主程序
    │   └── package.json # 依赖配置
    └── web/             # Web 界面（可选）
        └── index.html
```

### Docker 应用

```
my-docker-app/
├── manifest              # 应用配置
└── app/
    └── docker/
        └── docker-compose.yaml
```

## Manifest 配置

```
appname=my-app
name=我的应用
version=1.0.0
description=应用描述
type=native              # native 或 docker
author=snltty
icon=icon.png           # 可选
entry=server.js         # Native 应用入口
port=8080               # 可选
auto_start=false        # 可选
```

## 开发

### 构建

```bash
npm run build
```

### 开发模式

```bash
npm run dev
```

### 代码检查

```bash
npm run lint
npm run typecheck
```

### 发布到 npm

1. 更新版本号
```bash
npm version patch  # 或 minor / major
```

2. 构建并测试
```bash
npm run build
npm run typecheck
```

3. 发布
```bash
npm publish
```

### 项目结构

```
fnpackup-mcp-server/
├── src/
│   ├── index.ts                 # MCP 服务器入口
│   ├── tools/                   # 工具实现
│   │   ├── app-manager.ts       # 应用管理
│   │   ├── file-editor.ts       # 文件编辑
│   │   ├── config-editor.ts     # 配置编辑
│   │   ├── builder.ts           # 打包构建
│   │   ├── i18n-manager.ts      # 国际化管理
│   │   └── validator.ts         # 验证器
├── package.json
├── tsconfig.json
├── LICENSE
├── CHANGELOG.md
└── README.md
```

## 注意事项

1. **路径安全**: 所有文件操作限制在项目目录内
2. **用户确认**: 删除、覆盖等危险操作需要用户确认
3. **fnpack 依赖**: 需要安装 fnpack 工具
4. **编码支持**: 支持 UTF-8 和 Base64 编码文件

## 依赖要求

- Node.js 18+
- fnpack（打包工具）
- 项目目录：`../projects/`（或通过环境变量配置）

## License

MIT
