import path from "path";
import fs from "fs-extra";
import yaml from "yaml";

export class Validator {
  private appManager: any;

  constructor(appManager: any) {
    this.appManager = appManager;
  }

  /**
   * 验证应用配置
   */
  async validateApplication(appName: string) {
    const appPath = this.appManager.getAppPath(appName);

    if (!(await fs.pathExists(appPath))) {
      throw new Error(`应用不存在: ${appName}`);
    }

    const errors: any[] = [];
    const warnings: any[] = [];

    // 1. 验证 Manifest
    await this.validateManifest(appPath, errors, warnings);

    // 2. 验证目录结构
    await this.validateStructure(appPath, errors, warnings);

    // 3. 验证文件内容
    await this.validateFileContent(appPath, errors, warnings);

    // 4. 验证 Docker Compose（如果是 Docker 应用）
    await this.validateDockerCompose(appPath, errors, warnings);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              appName,
              valid: errors.length === 0,
              errors,
              warnings,
              summary: {
                errorCount: errors.length,
                warningCount: warnings.length,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * 验证 Manifest
   */
  private async validateManifest(appPath: string, errors: any[], warnings: any[]) {
    const manifestPath = path.join(appPath, "manifest");

    if (!(await fs.pathExists(manifestPath))) {
      errors.push({
        type: "manifest",
        severity: "error",
        message: "缺少 manifest 文件",
        suggestion: "创建 manifest 文件并配置应用基本信息",
      });
      return;
    }

    try {
      const content = await fs.readFile(manifestPath, "utf-8");
      const manifest = this.appManager.parseManifest(content);

      // 检查必需字段
      const requiredFields = [
        { key: "appname", desc: "应用名称" },
        { key: "name", desc: "显示名称" },
        { key: "version", desc: "版本号" },
        { key: "type", desc: "应用类型" },
      ];

      for (const field of requiredFields) {
        if (!manifest[field.key]) {
          errors.push({
            type: "manifest",
            severity: "error",
            field: field.key,
            message: `缺少必需字段: ${field.desc} (${field.key})`,
            suggestion: `在 manifest 中添加: ${field.key}=你的${field.desc}`,
          });
        }
      }

      // 检查 type 有效性
      if (manifest.type && !["native", "docker"].includes(manifest.type)) {
        errors.push({
          type: "manifest",
          severity: "error",
          field: "type",
          message: `无效的应用类型: ${manifest.type}`,
          suggestion: "type 必须是 'native' 或 'docker'",
        });
      }

      // 检查 appname 格式
      if (manifest.appname && !/^[a-zA-Z0-9_-]+$/.test(manifest.appname)) {
        errors.push({
          type: "manifest",
          severity: "error",
          field: "appname",
          message: `应用名称格式无效: ${manifest.appname}`,
          suggestion: "应用名称只能包含字母、数字、连字符和下划线",
        });
      }

      // 检查版本格式
      if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
        warnings.push({
          type: "manifest",
          severity: "warning",
          field: "version",
          message: `版本号格式建议使用语义化版本: ${manifest.version}`,
          suggestion: "推荐格式: 1.0.0",
        });
      }

      // 检查可选但推荐的字段
      const recommendedFields = [
        { key: "description", desc: "应用描述" },
        { key: "author", desc: "作者信息" },
      ];

      for (const field of recommendedFields) {
        if (!manifest[field.key]) {
          warnings.push({
            type: "manifest",
            severity: "warning",
            field: field.key,
            message: `缺少推荐字段: ${field.desc} (${field.key})`,
            suggestion: `在 manifest 中添加: ${field.key}=...`,
          });
        }
      }

    } catch (error) {
      errors.push({
        type: "manifest",
        severity: "error",
        message: `Manifest 文件解析失败: ${error instanceof Error ? error.message : String(error)}`,
        suggestion: "检查 manifest 文件格式是否正确",
      });
    }
  }

  /**
   * 验证目录结构
   */
  private async validateStructure(appPath: string, errors: any[], warnings: any[]) {
    const manifestPath = path.join(appPath, "manifest");
    let manifest: Record<string, string> = {};

    if (await fs.pathExists(manifestPath)) {
      const content = await fs.readFile(manifestPath, "utf-8");
      manifest = this.appManager.parseManifest(content);
    }

    const appType = manifest.type || "unknown";

    // 检查基础目录
    const appDir = path.join(appPath, "app");
    if (!(await fs.pathExists(appDir))) {
      errors.push({
        type: "structure",
        severity: "error",
        message: "缺少 app 目录",
        suggestion: "创建 app 目录",
      });
      return;
    }

    // Native 应用验证
    if (appType === "native") {
      const serverDir = path.join(appPath, "app", "server");
      if (!(await fs.pathExists(serverDir))) {
        errors.push({
          type: "structure",
          severity: "error",
          message: "Native 应用缺少 app/server 目录",
          suggestion: "创建 app/server 目录并上传服务端程序",
        });
      } else {
        // 检查是否有可执行文件
        const files = await fs.readdir(serverDir);
        const hasExecutable = files.some((f) => {
          const ext = path.extname(f).toLowerCase();
          return [".js", ".py", ".go", ".exe", ".sh"].includes(ext);
        });

        if (!hasExecutable) {
          warnings.push({
            type: "structure",
            severity: "warning",
            message: "app/server 目录似乎缺少可执行文件",
            suggestion: "上传 .js, .py, .go 等可执行文件",
          });
        }
      }

      // 检查 entry 配置
      if (manifest.entry) {
        const entryPath = path.join(appPath, "app", "server", manifest.entry);
        if (!(await fs.pathExists(entryPath))) {
          errors.push({
            type: "structure",
            severity: "error",
            field: "entry",
            message: `Manifest 中指定的入口文件不存在: ${manifest.entry}`,
            suggestion: `创建文件或更新 manifest 中的 entry 字段`,
          });
        }
      }
    }

    // Docker 应用验证
    if (appType === "docker") {
      const dockerComposePath = path.join(appPath, "app", "docker", "docker-compose.yaml");
      if (!(await fs.pathExists(dockerComposePath))) {
        errors.push({
          type: "structure",
          severity: "error",
          message: "Docker 应用缺少 app/docker/docker-compose.yaml",
          suggestion: "创建 docker-compose.yaml 文件",
        });
      }
    }

    // 检查图标
    if (manifest.icon) {
      const iconPath = path.join(appPath, manifest.icon);
      if (!(await fs.pathExists(iconPath))) {
        warnings.push({
          type: "structure",
          severity: "warning",
          field: "icon",
          message: `指定的图标文件不存在: ${manifest.icon}`,
          suggestion: "上传图标文件或移除 icon 配置",
        });
      }
    }
  }

  /**
   * 验证文件内容
   */
  private async validateFileContent(appPath: string, errors: any[], warnings: any[]) {
    // 检查常见问题
    const commonFiles = [
      "app/server/server.js",
      "app/server/package.json",
      "app/docker/docker-compose.yaml",
    ];

    for (const file of commonFiles) {
      const filePath = path.join(appPath, file);
      if (await fs.pathExists(filePath)) {
        const content = await fs.readFile(filePath, "utf-8");

        // 检查 package.json 格式
        if (file.endsWith("package.json")) {
          try {
            JSON.parse(content);
          } catch (e) {
            errors.push({
              type: "content",
              severity: "error",
              file,
              message: "package.json 格式错误",
              suggestion: "确保 package.json 是有效的 JSON 格式",
            });
          }
        }

        // 检查 YAML 格式
        if (file.endsWith(".yaml") || file.endsWith(".yml")) {
          try {
            yaml.parse(content);
          } catch (e) {
            errors.push({
              type: "content",
              severity: "error",
              file,
              message: "YAML 文件格式错误",
              suggestion: "检查 YAML 语法",
            });
          }
        }
      }
    }
  }

  /**
   * 验证 Docker Compose
   */
  private async validateDockerCompose(appPath: string, errors: any[], warnings: any[]) {
    const dockerComposePath = path.join(appPath, "app", "docker", "docker-compose.yaml");

    if (!(await fs.pathExists(dockerComposePath))) {
      return;
    }

    try {
      const content = await fs.readFile(dockerComposePath, "utf-8");
      const parsed = yaml.parse(content);

      // 检查是否有 services
      if (!parsed.services || Object.keys(parsed.services).length === 0) {
        errors.push({
          type: "docker",
          severity: "error",
          file: "app/docker/docker-compose.yaml",
          message: "Docker Compose 缺少 services 定义",
          suggestion: "在 docker-compose.yaml 中定义至少一个服务",
        });
      }

      // 检查端口映射
      for (const [serviceName, service] of Object.entries(parsed.services || {})) {
        const svc = service as { ports?: unknown };
        if (!svc.ports) {
          warnings.push({
            type: "docker",
            severity: "warning",
            service: serviceName,
            message: `服务 "${serviceName}" 没有配置端口映射`,
            suggestion: "如果需要从外部访问，请添加 ports 配置",
          });
        }
      }
    } catch (error) {
      errors.push({
        type: "docker",
        severity: "error",
        file: "app/docker/docker-compose.yaml",
        message: `Docker Compose 解析失败: ${error instanceof Error ? error.message : String(error)}`,
        suggestion: "检查 YAML 语法",
      });
    }
  }
}
