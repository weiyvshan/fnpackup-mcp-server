# Changelog

所有重要的更改都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
并且本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.0.3] - 2026-07-22

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
