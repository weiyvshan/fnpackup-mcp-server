# npm 发布快速参考

## 📦 当前状态

✅ **已配置完成** - 项目已准备好在 npm 发布

- 包名: `fnpackup-mcp-server`
- 版本: `1.0.0`
- 许可证: MIT
- 包大小: 32.3 kB

## 🔧 修改的文件

```
package.json          - 添加 bin, files, repository, homepage, engines 等
tsconfig.json         - 添加测试文件排除规则
README.md             - 添加徽章、npm 安装方式、Claude Code 配置
.gitignore            - 添加更多忽略项
```

## 📄 新增的文件

```
LICENSE               - MIT 许可证
.npmignore            - npm 发布排除规则
CHANGELOG.md          - 版本更新日志
NPM_GUIDE.md          - 详细发布指南
RELEASE_SUMMARY.md    - 发布总结文档
```

## 🚀 快速发布

### 1. 检查包名可用性

```bash
npm view fnpackup-mcp-server
```

如果返回 404，说明包名可用。

### 2. 登录 npm

```bash
npm login
# 输入用户名、密码和邮箱
```

### 3. 发布包

```bash
npm publish
```

### 4. 验证

```bash
npm view fnpackup-mcp-server
npm install -g fnpackup-mcp-server
fnpackup-mcp-server --help
```

## ⚠️ 发布前必做

1. **更新仓库地址**：
   - 编辑 `package.json`，将 `repository.url` 改为实际仓库地址
   - 当前为：`https://github.com/weiyvshan/qinglong-mcp-server.git`

2. **测试包内容**：
   ```bash
   npm pack --dry-run
   ```

3. **本地安装测试**：
   ```bash
   npm pack
   npm install ./fnpackup-mcp-server-1.0.0.tgz
   ```

## 📦 发布后使用

### 方式 1：全局安装（推荐）

```bash
npm install -g fnpackup-mcp-server
```

配置 Claude Code:
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

### 方式 2：npx 运行（无需安装）

```bash
npx fnpackup-mcp-server
```

### 方式 3：作为依赖

```bash
npm install fnpackup-mcp-server
```

## 🔄 版本更新

```bash
# 修订版（修复 bug）
npm version patch
git push && git push --tags
npm publish

# 次版本（新功能）
npm version minor
git push && git push --tags
npm publish

# 主版本（破坏性变更）
npm version major
git push && git push --tags
npm publish
```

## 📊 包内容

发布时包含：

```
fnpackup-mcp-server/
├── dist/                    # 编译输出（TypeScript → JavaScript）
│   ├── index.js            # 主入口文件
│   ├── index.d.ts          # 类型定义
│   ├── index.js.map        # 源映射
│   └── tools/              # 工具模块
│       ├── app-manager.*
│       ├── builder.*
│       ├── config-editor.*
│       ├── file-editor.*
│       ├── i18n-manager.*
│       └── validator.*
├── LICENSE                  # MIT 许可证
├── README.md                # 使用文档
└── package.json            # 包配置
```

**总计**: 31 个文件，32.3 kB

## 🚫 .npmignore 排除的内容

```
node_modules/     # 依赖
.git/            # Git 仓库
*.log            # 日志文件
.env*            # 环境变量
.vscode/         # IDE 配置
.idea/           # IDE 配置
*.md（部分）     # 除 README.md 和 CHANGELOG.md
```

## 📝 参考文档

- [NPM_GUIDE.md](./NPM_GUIDE.md) - 详细发布指南
- [RELEASE_SUMMARY.md](./RELEASE_SUMMARY.md) - 完整变更总结
- [README.md](./README.md) - 使用文档
- [qinglong-mcp-server](https://github.com/weiyvshan/qinglong-mcp-server) - 参考仓库

## ⚡ 常见问题

### Q: 包名已被占用怎么办？

A: 选择其他包名，推荐格式：
- `mcp-fnpackup-packager`
- `@fnpackup/mcp-server`
- `fnpackup-mcp-packager`

### Q: 如何撤回已发布的包？

A: 发布后 72 小时内可以撤回：
```bash
npm unpublish fnpackup-mcp-server@1.0.0
```

### Q: 发布失败怎么办？

A: 常见原因：
- 包名已存在
- 版本号未更新
- 未登录或权限不足
- 网络问题

### Q: 如何查看发布历史？

A:
```bash
npm view fnpackup-mcp-server versions
```

---

**下一步**: 更新 `package.json` 中的 `repository` 字段，然后运行 `npm publish`
