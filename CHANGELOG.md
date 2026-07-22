# Changelog

所有重要的更改都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
并且本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Fixed

- **严重问题修复**: build_fpk 完全重写，从调用本地 fnpack CLI 改为调用 fnpackup 服务 API
  - 移除所有本地 fnpack CLI 调用逻辑（`findFnpack`、`executeCommand`、`findGeneratedFpk`、`findFpkInTempDir`）
  - 新增 `callFnpackupService()` 方法，通过 HTTP POST 调用 `/project/pack` 端点
  - 添加 `FNPACKUP_SERVICE_URL` 环境变量配置（默认 `http://localhost:1069`）
  - 提供清晰的连接失败错误提示
  - 产物路径由 fnpackup 服务管理，不再在 MCP 层搜索

- **环境变量修复**: PROJECTS_DIR 环境变量现在正常工作
  - 在 `AppManager` constructor 中添加环境变量读取逻辑
  - 优先级：环境变量 > 默认路径

### Changed

- 架构调整: MCP server 现在正确作为 fnpackup Web 服务的 Agent 接口
- 不再依赖本地 fnpack CLI 工具
- 不再需要 `child_process` 依赖

### Documentation

- 所有文档路径示例改为跨平台格式（Unix 风格）
- 添加环境变量详细说明
- 新增认证说明文档（fnpackup 服务无需认证）
- 新增配置复核报告（`fnpackup配置复核.md`）
- 新增修复总结（`修复总结.md`）

## [1.0.2] - 2026-07-22

### Fixed

- 修复 build_fpk 找不到 fnpack 临时目录中的 .fpk 文件的问题

### Added

- 新增在临时目录中查找 .fpk 文件的逻辑

## [1.0.0] - 2026-07-21

### Added

- 初始版本发布
- MCP 服务器用于打包 FPK 应用程序
- 应用管理工具（创建、列出、删除、导入应用）
- 文件编辑工具（读写、智能编辑、上传）
- 配置编辑工具（Manifest、环境变量、Docker Compose）
- 打包构建工具
- 国际化管理工具
- 应用验证工具
- 完整的文档和使用指南
