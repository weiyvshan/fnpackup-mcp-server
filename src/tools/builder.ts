import path from "path";
import fs from "fs-extra";
import { spawn } from "child_process";
import { promisify } from "util";
import { exec as execCb } from "child_process";

const exec = promisify(execCb);

export class FpkBuilder {
  private appManager: any;

  constructor(appManager: any) {
    this.appManager = appManager;
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
      // 查找 fnpack 可执行文件
      const fnpackPath = this.findFnpack();

      // 构建命令
      const args = ["build", appName];

      // 执行打包
      const result = await this.executeCommand(fnpackPath, args, {
        cwd: this.appManager.projectsDir || path.dirname(appPath),
      });

      const duration = Date.now() - startTime;

      // 查找生成的 fpk 文件
      const generatedFpk = await this.findGeneratedFpk(appPath);

      if (!generatedFpk) {
        throw new Error("打包完成但未找到生成的 .fpk 文件");
      }

      // 如果指定了输出路径，移动文件
      if (outputPath) {
        const outputFullPath = path.resolve(outputPath);
        await fs.ensureDir(path.dirname(outputFullPath));
        await fs.move(generatedFpk, outputFullPath);
        return this.formatResult(true, outputFullPath, duration);
      }

      return this.formatResult(true, generatedFpk, duration);
    } catch (error) {
      const duration = Date.now() - startTime;
      return this.formatResult(false, null, duration, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 查找 fnpack 可执行文件
   */
  private findFnpack(): string {
    // 优先查找项目目录中的 fnpack
    const localFnpack = path.resolve(process.cwd(), "..", "fnpack.exe");
    if (fs.existsSync(localFnpack)) {
      return localFnpack;
    }

    // 查找系统 PATH 中的 fnpack
    const fnpackInPath = process.env.PATH?.split(path.delimiter).find((dir) => {
      const fnpackPath = path.join(dir, "fnpack.exe");
      return fs.existsSync(fnpackPath);
    });

    if (fnpackInPath) {
      return path.join(fnpackInPath, "fnpack.exe");
    }

    throw new Error(
      "找不到 fnpack 可执行文件。请确保 fnpack.exe 位于项目目录或系统 PATH 中。"
    );
  }

  /**
   * 执行命令
   */
  private async executeCommand(
    command: string,
    args: string[],
    options: { cwd?: string } = {}
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        cwd: options.cwd,
        shell: true,
        windowsHide: true,
      });

      let stdout = "";
      let stderr = "";

      proc.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`命令执行失败 (退出码 ${code}):\n${stderr || stdout}`));
        }
      });

      proc.on("error", (err) => {
        reject(new Error(`命令执行错误: ${err.message}`));
      });
    });
  }

  /**
   * 查找生成的 fpk 文件
   */
  private async findGeneratedFpk(appPath: string): Promise<string | null> {
    try {
      // 首先在应用目录中查找
      const files = await fs.readdir(appPath);
      const fpkFile = files.find((f) => f.endsWith(".fpk"));

      if (fpkFile) {
        const fpkFullPath = path.join(appPath, fpkFile);
        const stat = await fs.stat(fpkFullPath);

        // 确保是最近生成的文件（5分钟内）
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        if (stat.mtimeMs > fiveMinutesAgo) {
          return fpkFullPath;
        }
      }

      // 如果应用目录中没找到，搜索临时目录
      const tempDir = process.env.TEMP || process.env.TMP || "/tmp";
      const tempFpk = await this.findFpkInTempDir(tempDir, appPath);
      if (tempFpk) {
        return tempFpk;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 在临时目录中查找 fpk 文件
   */
  private async findFpkInTempDir(tempDir: string, appPath: string): Promise<string | null> {
    try {
      const tempPath = path.resolve(tempDir);

      // 读取临时目录
      const entries = await fs.readdir(tempPath, { withFileTypes: true });

      // 查找 fnpack.* 开头的目录
      const fnpackDirs = entries
        .filter((entry) => entry.isDirectory() && entry.name.startsWith("fnpack."))
        .map((entry) => path.join(tempPath, entry.name))
        .sort((a, b) => {
          // 按修改时间降序排序，优先检查最新的目录
          return (fs.statSync(b).mtimeMs || 0) - (fs.statSync(a).mtimeMs || 0);
        });

      // 遍历 fnpack 临时目录查找 fpk 文件
      for (const dir of fnpackDirs) {
        try {
          const files = await fs.readdir(dir);
          const fpkFile = files.find((f) => f.endsWith(".fpk"));

          if (fpkFile) {
            const fpkFullPath = path.join(dir, fpkFile);
            const stat = await fs.stat(fpkFullPath);

            // 确保是最近生成的文件（5分钟内）
            const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
            if (stat.mtimeMs > fiveMinutesAgo) {
              // 将文件移动到应用目录
              const targetPath = path.join(appPath, fpkFile);
              await fs.move(fpkFullPath, targetPath);
              return targetPath;
            }
          }
        } catch (error) {
          // 继续检查下一个目录
          continue;
        }
      }

      return null;
    } catch (error) {
      return null;
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
