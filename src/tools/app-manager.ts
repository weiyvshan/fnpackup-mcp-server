import path from "path";
import fs from "fs-extra";
import { v4 as uuidv4 } from "uuid";

export class AppManager {
  private projectsDir: string;

  constructor() {
    // 优先使用环境变量 PROJECTS_DIR，否则使用默认路径
    const envProjectsDir = process.env.PROJECTS_DIR;
    if (envProjectsDir) {
      this.projectsDir = path.resolve(envProjectsDir);
    } else {
      // 默认指向 fnpackup 的 projects 目录
      this.projectsDir = path.resolve(process.cwd(), "..", "projects");
    }
  }

  /**
   * 设置项目目录
   */
  setProjectsDir(dir: string) {
    this.projectsDir = path.resolve(dir);
  }

  /**
   * 获取应用目录路径
   */
  getAppPath(appName: string): string {
    return path.join(this.projectsDir, appName);
  }

  /**
   * 验证应用名称
   */
  private validateAppName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error("应用名称不能为空");
    }
    // 只允许字母、数字、连字符、下划线
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw new Error("应用名称只能包含字母、数字、连字符和下划线");
    }
  }

  /**
   * 列出所有应用
   */
  async listApplications() {
    await fs.ensureDir(this.projectsDir);

    const apps: any[] = [];

    try {
      const entries = await fs.readdir(this.projectsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const appPath = path.join(this.projectsDir, entry.name);
          const manifestPath = path.join(appPath, "manifest");

          const appInfo: any = {
            name: entry.name,
            path: appPath,
            type: "unknown",
            hasManifest: false,
            lastModified: (await fs.stat(appPath)).mtime,
          };

          // 检查是否存在 manifest
          if (await fs.pathExists(manifestPath)) {
            appInfo.hasManifest = true;
            try {
              const manifestContent = await fs.readFile(manifestPath, "utf-8");
              const manifest = this.parseManifest(manifestContent);
              appInfo.type = manifest.type || "unknown";
              appInfo.displayName = manifest.name || entry.name;
              appInfo.version = manifest.version;
              appInfo.description = manifest.description;
            } catch (e) {
              // Manifest 解析失败，保持默认值
            }
          }

          // 检查是否有 fpk 文件
          const files = await fs.readdir(appPath);
          const fpkFiles = files.filter((f) => f.endsWith(".fpk"));
          appInfo.fpkFiles = fpkFiles;

          apps.push(appInfo);
        }
      }
    } catch (error) {
      throw new Error(`读取应用列表失败: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              count: apps.length,
              projectsDir: this.projectsDir,
              apps,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * 创建新应用
   */
  async createApplication(name: string, type: "native" | "docker", description?: string) {
    this.validateAppName(name);

    const appPath = this.getAppPath(name);

    // 检查是否已存在
    if (await fs.pathExists(appPath)) {
      throw new Error(`应用 "${name}" 已存在`);
    }

    try {
      // 创建基础目录结构
      if (type === "native") {
        await fs.ensureDir(path.join(appPath, "app", "server"));
        await fs.ensureDir(path.join(appPath, "app", "web"));
      } else if (type === "docker") {
        await fs.ensureDir(path.join(appPath, "app", "docker"));
      }

      // 创建 manifest 文件
      const manifest = this.createDefaultManifest(name, type, description);
      await fs.writeFile(path.join(appPath, "manifest"), manifest);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                message: `应用 "${name}" 创建成功`,
                app: {
                  name,
                  type,
                  path: appPath,
                  description: description || "",
                },
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      // 清理已创建的目录
      if (await fs.pathExists(appPath)) {
        await fs.remove(appPath);
      }
      throw error;
    }
  }

  /**
   * 创建默认 manifest
   */
  private createDefaultManifest(name: string, type: "native" | "docker", description?: string): string {
    const timestamp = new Date().toISOString().split("T")[0];

    const lines: string[] = [
      `appname=${name}`,
      `name=${name}`,
      `version=1.0.0`,
      `type=${type}`,
      `author=snltty`,
      `description=${description || "新建的 fpk 应用"}`,
    ];

    if (type === "native") {
      lines.push("auto_start=false");
    }

    return lines.join("\n") + "\n";
  }

  /**
   * 解析 manifest 文件
   */
  parseManifest(content: string): Record<string, string> {
    const result: Record<string, string> = {};

    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith(";")) {
        continue;
      }

      const index = trimmed.indexOf("=");
      if (index > 0) {
        const key = trimmed.substring(0, index).trim();
        const value = trimmed.substring(index + 1).trim();
        if (key) {
          result[key] = value;
        }
      }
    }

    return result;
  }

  /**
   * 序列化 manifest 为字符串
   */
  serializeManifest(manifest: Record<string, string>): string {
    const lines: string[] = [];
    for (const [key, value] of Object.entries(manifest)) {
      lines.push(`${key}=${value}`);
    }
    return lines.join("\n") + "\n";
  }

  /**
   * 导入 fpk 文件
   */
  async importFpk(fpkPath: string, targetName?: string) {
    if (!await fs.pathExists(fpkPath)) {
      throw new Error(`文件不存在: ${fpkPath}`);
    }

    const ext = path.extname(fpkPath).toLowerCase();
    if (ext !== ".fpk") {
      throw new Error(`文件不是有效的 .fpk 文件: ${fpkPath}`);
    }

    // 确定应用名称
    const originalName = targetName || path.basename(fpkPath, ".fpk");
    this.validateAppName(originalName);

    const appPath = this.getAppPath(originalName);

    // 检查是否已存在
    if (await fs.pathExists(appPath)) {
      throw new Error(`应用 "${originalName}" 已存在`);
    }

    try {
      // 解压 fpk 文件
      await fs.ensureDir(appPath);
      await this.extractFpk(fpkPath, appPath);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                message: `FPK 文件导入成功`,
                app: {
                  name: originalName,
                  path: appPath,
                  sourceFile: fpkPath,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      // 清理
      if (await fs.pathExists(appPath)) {
        await fs.remove(appPath);
      }
      throw error;
    }
  }

  /**
   * 解压 fpk 文件（实际上是 zip 格式）
   */
  private async extractFpk(fpkPath: string, targetDir: string) {
    const AdmZip = (await import("adm-zip")).default;
    const zip = new AdmZip(fpkPath);
    zip.extractAllTo(targetDir, true);
  }

  /**
   * 打开应用
   */
  async openApplication(appName: string) {
    this.validateAppName(appName);

    const appPath = this.getAppPath(appName);

    if (!(await fs.pathExists(appPath))) {
      throw new Error(`应用不存在: ${appName}`);
    }

    // 获取应用详细信息
    const manifestPath = path.join(appPath, "manifest");
    let manifest: Record<string, string> = {};
    let manifestContent = "";

    if (await fs.pathExists(manifestPath)) {
      manifestContent = await fs.readFile(manifestPath, "utf-8");
      manifest = this.parseManifest(manifestContent);
    }

    // 获取文件列表
    const fileList = await this.getFileListRecursive(appPath, appPath);

    // 获取目录结构
    const structure = await this.getDirectoryStructure(appPath);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              name: appName,
              path: appPath,
              type: manifest.type || "unknown",
              manifest: manifest,
              manifestContent: manifestContent,
              fileCount: fileList.length,
              files: fileList,
              structure,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * 递归获取文件列表
   */
  private async getFileListRecursive(dir: string, baseDir: string): Promise<string[]> {
    const files: string[] = [];

    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);

      // 跳过隐藏文件和目录
      if (entry.name.startsWith(".")) {
        continue;
      }

      if (entry.isDirectory()) {
        const subFiles = await this.getFileListRecursive(fullPath, baseDir);
        files.push(...subFiles);
      } else {
        files.push(relativePath.replace(/\\/g, "/"));
      }
    }

    return files.sort();
  }

  /**
   * 获取目录结构
   */
  private async getDirectoryStructure(dir: string, maxDepth: number = 3, currentDepth: number = 0): Promise<any> {
    if (currentDepth >= maxDepth) {
      return null;
    }

    const structure: any = {
      name: path.basename(dir),
      type: "directory",
      children: [],
    };

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        // 跳过隐藏文件
        if (entry.name.startsWith(".")) {
          continue;
        }

        if (entry.isDirectory()) {
          const child = await this.getDirectoryStructure(
            path.join(dir, entry.name),
            maxDepth,
            currentDepth + 1
          );
          if (child) {
            structure.children.push(child);
          }
        } else {
          const stat = await fs.stat(path.join(dir, entry.name));
          structure.children.push({
            name: entry.name,
            type: "file",
            size: stat.size,
            modified: stat.mtime,
          });
        }
      }
    } catch (error) {
      // 忽略读取错误
    }

    return structure;
  }

  /**
   * 删除应用
   */
  async deleteApplication(appName: string, confirm: boolean) {
    if (!confirm) {
      throw new Error("删除操作需要确认，请将 confirm 参数设置为 true");
    }

    this.validateAppName(appName);

    const appPath = this.getAppPath(appName);

    if (!(await fs.pathExists(appPath))) {
      throw new Error(`应用不存在: ${appName}`);
    }

    await fs.remove(appPath);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              message: `应用 "${appName}" 已删除`,
            },
            null,
            2
          ),
        },
      ],
    };
  }
}
