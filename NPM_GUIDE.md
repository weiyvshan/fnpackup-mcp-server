# npm 发布指南

## 发布前检查清单

- [ ] 更新版本号（`npm version [patch|minor|major]`）
- [ ] 更新 CHANGELOG.md
- [ ] 确保所有测试通过（如果有）
- [ ] 运行 `npm run build` 确认构建成功
- [ ] 运行 `npm run typecheck` 确认无类型错误
- [ ] 测试包内容：`npm pack --dry-run`

## 发布步骤

### 1. 登录 npm

```bash
npm login
```

### 2. 检查包名是否可用

```bash
npm view fnpackup-mcp-server
```

如果包已存在，会显示包信息；如果不存在，会显示 404。

### 3. 发布包

```bash
npm publish
```

### 4. 验证发布

```bash
npm view fnpackup-mcp-server
```

## 包内容

发布的包包含以下文件和目录：

```
fnpackup-mcp-server/
├── dist/                    # 编译后的 JavaScript 文件
│   ├── index.js            # 主入口
│   ├── index.d.ts          # 类型定义
│   └── tools/              # 工具模块
├── README.md                # 使用文档
├── LICENSE                  # MIT 许可证
└── package.json            # 包配置
```

## 使用方式

### 方式 A：全局安装

```bash
npm install -g fnpackup-mcp-server
```

然后在 Claude Code 配置中使用：

```json
{
  "mcpServers": {
    "fpk-packager": {
      "command": "fnpackup-mcp-server",
      "env": {
        "PROJECTS_DIR": "/path/to/projects"
      }
    }
  }
}
```

### 方式 B：npx 运行（无需安装）

```bash
npx fnpackup-mcp-server
```

### 方式 C：作为依赖安装

```bash
npm install fnpackup-mcp-server
```

然后在项目中导入：

```javascript
import { runServer } from 'fnpackup-mcp-server';
```

## 版本管理

遵循 [语义化版本](https://semver.org/lang/zh-CN/)：

- `1.0.0` - 主版本号：不兼容的 API 修改
- `0.1.0` - 次版本号：向下兼容的功能性新增
- `0.0.1` - 修订号：向下兼容的问题修正

### 版本更新命令

```bash
# 修订版本（修复 bug）
npm version patch

# 次版本（新功能）
npm version minor

# 主版本（破坏性变更）
npm version major
```

## 包名建议

当前包名：`fnpackup-mcp-server`

如果需要重命名，可以：

1. 在 npm 上搜索确认名称可用
2. 更新 `package.json` 中的 `name` 字段
3. 更新文档中的包名

常见命名模式：
- `mcp-fnpackup-packager`
- `@fnpackup/mcp-server`
- `fnpackup-mcp`

## 维护

### 更新依赖

```bash
npm update
npm audit fix
```

### 查看已发布版本

```bash
npm view fnpackup-mcp-server versions
```

### 撤回已发布版本

```bash
npm unpublish fnpackup-mcp-server@1.0.0
```

**注意**：npm 包一旦发布后 72 小时内可以撤回，超过时间无法撤回。
