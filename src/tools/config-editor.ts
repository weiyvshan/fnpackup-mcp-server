import path from "path";
import fs from "fs-extra";
import yaml from "yaml";

export class ConfigEditor {
  private appManager: any;

  constructor(appManager: any) {
    this.appManager = appManager;
  }

  /**
   * 编辑 manifest 文件
   */
  async editManifest(appName: string, updates: Record<string, any>) {
    const appPath = this.appManager.getAppPath(appName);
    const manifestPath = path.join(appPath, "manifest");

    if (!(await fs.pathExists(appPath))) {
      throw new Error(`应用不存在: ${appName}`);
    }

    // 读取现有 manifest
    let manifestContent = "";
    let manifest: Record<string, string> = {};

    if (await fs.pathExists(manifestPath)) {
      manifestContent = await fs.readFile(manifestPath, "utf-8");
      manifest = this.appManager.parseManifest(manifestContent);
    }

    // 应用更新
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === undefined) {
        delete manifest[key];
      } else if (typeof value === "object") {
        // 对于复杂对象，转为 JSON 字符串
        manifest[key] = JSON.stringify(value);
      } else {
        manifest[key] = String(value);
      }
    }

    // 写回 manifest
    const newContent = this.appManager.serializeManifest(manifest);
    await fs.writeFile(manifestPath, newContent, "utf-8");

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              message: `Manifest 已更新`,
              appName,
              updates,
              currentManifest: manifest,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * 编辑环境变量
   */
  async editEnv(appName: string, envVars: Record<string, string>) {
    const appPath = this.appManager.getAppPath(appName);
    const envPath = path.join(appPath, "app", ".env");

    if (!(await fs.pathExists(appPath))) {
      throw new Error(`应用不存在: ${appName}`);
    }

    // 读取现有 env 文件
    let envContent = "";
    let env: Record<string, string> = {};

    if (await fs.pathExists(envPath)) {
      envContent = await fs.readFile(envPath, "utf-8");
      env = this.parseEnvFile(envContent);
    }

    // 应用更新
    for (const [key, value] of Object.entries(envVars)) {
      if (value === null || value === undefined) {
        delete env[key];
      } else {
        env[key] = String(value);
      }
    }

    // 写回
    const newContent = this.serializeEnvFile(env);
    await fs.writeFile(envPath, newContent, "utf-8");

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              message: `环境变量已更新`,
              appName,
              updates: envVars,
              currentEnv: env,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * 解析 .env 文件
   */
  private parseEnvFile(content: string): Record<string, string> {
    const result: Record<string, string> = {};

    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const index = trimmed.indexOf("=");
      if (index > 0) {
        const key = trimmed.substring(0, index).trim();
        let value = trimmed.substring(index + 1).trim();

        // 移除引号
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        result[key] = value;
      }
    }

    return result;
  }

  /**
   * 序列化 .env 文件
   */
  private serializeEnvFile(env: Record<string, string>): string {
    const lines: string[] = [];
    for (const [key, value] of Object.entries(env)) {
      // 如果值包含空格或特殊字符，添加引号
      if (value.includes(" ") || value.includes("#") || value.includes("=")) {
        lines.push(`${key}="${value}"`);
      } else {
        lines.push(`${key}=${value}`);
      }
    }
    return lines.join("\n") + "\n";
  }

  /**
   * 编辑 Docker Compose 配置
   */
  async editDockerCompose(appName: string, content: string) {
    const appPath = this.appManager.getAppPath(appName);
    const dockerComposePath = path.join(appPath, "app", "docker", "docker-compose.yaml");

    if (!(await fs.pathExists(appPath))) {
      throw new Error(`应用不存在: ${appName}`);
    }

    // 确保目录存在
    await fs.ensureDir(path.dirname(dockerComposePath));

    // 验证 YAML 语法
    try {
      yaml.parse(content);
    } catch (error) {
      throw new Error(`Docker Compose YAML 语法错误: ${error instanceof Error ? error.message : String(error)}`);
    }

    // 写入文件
    await fs.writeFile(dockerComposePath, content, "utf-8");

    // 验证格式
    const parsed = yaml.parse(content);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              message: `Docker Compose 配置已更新`,
              appName,
              path: "app/docker/docker-compose.yaml",
              services: Object.keys(parsed.services || {}),
              validation: {
                valid: true,
                services: Object.keys(parsed.services || {}),
              },
            },
            null,
            2
          ),
        },
      ],
    };
  }
}
