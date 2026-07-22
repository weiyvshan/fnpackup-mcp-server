import path from "path";
import fs from "fs-extra";

export class FpkBuilder {
  private appManager: any;
  private fnpackupServiceUrl: string;

  constructor(appManager: any) {
    this.appManager = appManager;
    // fnpackup service URL - defaults to localhost:1069
    this.fnpackupServiceUrl = process.env.FNPACKUP_SERVICE_URL || "http://localhost:1069";
  }

  /**
   * 构建 FPK 文件
   */
  async buildFpk(appName: string, outputPath?: string) {
    const appPath = this.appManager.getAppPath(appName);

    if (!(await fs.pathExists(appPath))) {
      throw new Error(`应用不存在: ${appName}`);
    }

    // 检查 manifest
    const manifestPath = path.join(appPath, "manifest");
    if (!(await fs.pathExists(manifestPath))) {
      throw new Error(`应用缺少 manifest 文件`);
    }

    // 验证应用
    const validation = await this.validateApp(appName);
    if (!validation.valid) {
      throw new Error(
        `应用验证失败:\n${validation.errors.map((e: any) => `  - ${e.message}`).join("\n")}`
      );
    }

    const startTime = Date.now();

    try {
      // 调用 fnpackup 服务 API 进行打包
      const result = await this.callFnpackupService(appName);

      const duration = Date.now() - startTime;

      if (!result.success) {
        throw new Error(result.error || "打包失败");
      }

      // 如果指定了输出路径，复制文件
      if (outputPath) {
        const outputFullPath = path.resolve(outputPath);
        await fs.ensureDir(path.dirname(outputFullPath));
        await fs.copy(result.fpkPath!, outputFullPath);
        return this.formatResult(true, outputFullPath, duration);
      }

      return this.formatResult(true, result.fpkPath!, duration);
    } catch (error) {
      const duration = Date.now() - startTime;
      return this.formatResult(false, null, duration, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 调用 fnpackup 服务 API 进行打包
   */
  private async callFnpackupService(appName: string): Promise<{ success: boolean; fpkPath?: string; error?: string }> {
    try {
      // 调用 fnpackup 服务的 /project/pack 端点
      const response = await fetch(`${this.fnpackupServiceUrl}/project/pack?name=${encodeURIComponent(appName)}`, {
        method: "POST",
        headers: {
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`fnpackup 服务返回错误: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as Array<{ FileName: string; Msg: string }>;

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("fnpackup 服务返回了无效的响应格式");
      }

      // 查找成功的打包结果
      const successResult = data.find(item => item.FileName && item.FileName.endsWith(".fpk"));

      if (!successResult) {
        const errorMsg = data[0].Msg || "打包失败，未生成 .fpk 文件";
        throw new Error(errorMsg);
      }

      // fpk 文件应该在应用目录中
      const fpkPath = path.join(this.appManager.getAppPath(appName), successResult.FileName);

      // 验证文件是否存在
      if (!(await fs.pathExists(fpkPath))) {
        throw new Error(`打包完成但未找到生成的 .fpk 文件: ${successResult.FileName}`);
      }

      return { success: true, fpkPath };
    } catch (error) {
      if (error instanceof Error) {
        // 提供更友好的错误信息
        if (error.message.includes("fetch failed") || error.message.includes("ECONNREFUSED") || error.message.includes("ENOTFOUND")) {
          return {
            success: false,
            error: `无法连接到 fnpackup 服务 (${this.fnpackupServiceUrl})。请确保 fnpackup 服务已启动。\n原始错误: ${error.message}`
          };
        }
        return { success: false, error: error.message };
      }
      return { success: false, error: String(error) };
    }
  }

  /**
   * 验证应用
   */
  private async validateApp(appName: string): Promise<{ valid: boolean; errors: any[] }> {
    const appPath = this.appManager.getAppPath(appName);
    const errors: any[] = [];

    // 检查 manifest
    const manifestPath = path.join(appPath, "manifest");
    if (!(await fs.pathExists(manifestPath))) {
      errors.push({
        type: "manifest",
        message: "缺少 manifest 文件",
      });
    } else {
      const manifestContent = await fs.readFile(manifestPath, "utf-8");
      const manifest = this.appManager.parseManifest(manifestContent);

      if (!manifest.appname) {
        errors.push({
          type: "manifest",
          message: "manifest 缺少 appname 字段",
        });
      }

      if (!manifest.name) {
        errors.push({
          type: "manifest",
          message: "manifest 缺少 name 字段",
        });
      }

      if (!manifest.version) {
        errors.push({
          type: "manifest",
          message: "manifest 缺少 version 字段",
        });
      }

      if (!manifest.type) {
        errors.push({
          type: "manifest",
          message: "manifest 缺少 type 字段",
        });
      } else if (!["native", "docker"].includes(manifest.type)) {
        errors.push({
          type: "manifest",
          message: `type 字段无效: ${manifest.type}（必须是 native 或 docker）`,
        });
      }

      // Native 应用检查
      if (manifest.type === "native") {
        const serverPath = path.join(appPath, "app", "server");
        if (!(await fs.pathExists(serverPath))) {
          errors.push({
            type: "structure",
            message: "Native 应用缺少 app/server 目录",
          });
        }
      }

      // Docker 应用检查
      if (manifest.type === "docker") {
        const dockerComposePath = path.join(appPath, "app", "docker", "docker-compose.yaml");
        if (!(await fs.pathExists(dockerComposePath))) {
          errors.push({
            type: "structure",
            message: "Docker 应用缺少 app/docker/docker-compose.yaml 文件",
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 格式化结果
   */
  private formatResult(success: boolean, fpkPath: string | null, duration: number, error?: string) {
    const result: any = {
      success,
      duration: `${duration}ms`,
    };

    if (success && fpkPath) {
      try {
        const stat = fs.statSync(fpkPath);
        result.fpk = {
          path: fpkPath,
          filename: path.basename(fpkPath),
          size: stat.size,
          sizeHuman: this.formatFileSize(stat.size),
        };
      } catch (e) {
        result.fpk = {
          path: fpkPath,
        };
      }
    }

    if (error) {
      result.error = error;
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  /**
   * 格式化文件大小
   */
  private formatFileSize(bytes: number): string {
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}
