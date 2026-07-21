import path from "path";
import fs from "fs-extra";

export class FileEditor {
  private appManager: any;

  constructor(appManager: any) {
    this.appManager = appManager;
  }

  /**
   * 列出应用目录结构
   */
  async listFiles(appName: string, targetPath?: string, recursive: boolean = false) {
    const appPath = this.appManager.getAppPath(appName);

    if (!(await fs.pathExists(appPath))) {
      throw new Error(`应用不存在: ${appName}`);
    }

    const basePath = targetPath ? path.join(appPath, targetPath) : appPath;

    if (!(await fs.pathExists(basePath))) {
      throw new Error(`路径不存在: ${targetPath || "/"}`);
    }

    if (recursive) {
      const files = await this.getFileListRecursive(basePath, appPath);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                path: targetPath || "/",
                files,
                count: files.length,
              },
              null,
              2
            ),
          },
        ],
      };
    } else {
      const entries = await fs.readdir(basePath, { withFileTypes: true });
      const result: any[] = [];

      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;

        const fullPath = path.join(basePath, entry.name);
        const stat = await fs.stat(fullPath);
        const relativePath = path.relative(appPath, fullPath).replace(/\\/g, "/");

        result.push({
          name: entry.name,
          type: entry.isDirectory() ? "directory" : "file",
          size: stat.size,
          modified: stat.mtime,
          path: relativePath,
        });
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                path: targetPath || "/",
                items: result,
                count: result.length,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  /**
   * 递归获取文件列表
   */
  private async getFileListRecursive(dir: string, baseDir: string, prefix: string = ""): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;

      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        const subFiles = await this.getFileListRecursive(
          path.join(dir, entry.name),
          baseDir,
          relativePath
        );
        files.push(...subFiles);
      } else {
        files.push(relativePath);
      }
    }

    return files.sort();
  }

  /**
   * 读取文件内容
   */
  async readFile(appName: string, filePath: string) {
    const appPath = this.appManager.getAppPath(appName);
    const fullPath = path.join(appPath, filePath);

    // 安全检查：确保路径在应用目录内
    const resolvedPath = path.resolve(fullPath);
    const resolvedAppPath = path.resolve(appPath);
    if (!resolvedPath.startsWith(resolvedAppPath)) {
      throw new Error("非法文件路径");
    }

    if (!(await fs.pathExists(fullPath))) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    const stat = await fs.stat(fullPath);
    if (stat.isDirectory()) {
      throw new Error(`路径是目录而非文件: ${filePath}`);
    }

    // 尝试以 UTF-8 读取，失败则使用 base64
    let content: string;
    let encoding = "utf-8";

    try {
      content = await fs.readFile(fullPath, "utf-8");
    } catch (e) {
      // 可能是二进制文件
      const buffer = await fs.readFile(fullPath);
      content = buffer.toString("base64");
      encoding = "base64";
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              path: filePath,
              encoding,
              size: stat.size,
              content,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * 写入文件
   */
  async writeFile(appName: string, filePath: string, content: string, encoding: string = "utf-8") {
    const appPath = this.appManager.getAppPath(appName);
    const fullPath = path.join(appPath, filePath);

    // 安全检查
    const resolvedPath = path.resolve(fullPath);
    const resolvedAppPath = path.resolve(appPath);
    if (!resolvedPath.startsWith(resolvedAppPath)) {
      throw new Error("非法文件路径");
    }

    // 确保目录存在
    await fs.ensureDir(path.dirname(fullPath));

    // 根据编码写入
    if (encoding === "base64") {
      const buffer = Buffer.from(content, "base64");
      await fs.writeFile(fullPath, buffer);
    } else {
      await fs.writeFile(fullPath, content, "utf-8");
    }

    const stat = await fs.stat(fullPath);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              message: `文件已写入: ${filePath}`,
              path: filePath,
              size: stat.size,
              encoding,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * 编辑文件（基于替换）
   */
  async editFile(appName: string, filePath: string, edits: Array<{ old_string: string; new_string: string }>) {
    if (!edits || edits.length === 0) {
      throw new Error("edits 参数不能为空");
    }

    const appPath = this.appManager.getAppPath(appName);
    const fullPath = path.join(appPath, filePath);

    // 安全检查
    const resolvedPath = path.resolve(fullPath);
    const resolvedAppPath = path.resolve(appPath);
    if (!resolvedPath.startsWith(resolvedAppPath)) {
      throw new Error("非法文件路径");
    }

    if (!(await fs.pathExists(fullPath))) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    // 读取原文件
    const originalContent = await fs.readFile(fullPath, "utf-8");
    let newContent = originalContent;

    // 应用所有编辑
    const appliedEdits: any[] = [];
    const failedEdits: any[] = [];

    for (let i = 0; i < edits.length; i++) {
      const edit = edits[i];
      const oldString = edit.old_string;
      const newString = edit.new_string;

      if (newContent.includes(oldString)) {
        newContent = newContent.replace(oldString, newString);
        appliedEdits.push({
          index: i,
          old_string: oldString.substring(0, 50) + (oldString.length > 50 ? "..." : ""),
          new_string: newString.substring(0, 50) + (newString.length > 50 ? "..." : ""),
        });
      } else {
        failedEdits.push({
          index: i,
          old_string: oldString.substring(0, 100) + (oldString.length > 100 ? "..." : ""),
          error: "未找到匹配的文本",
        });
      }
    }

    // 如果有编辑成功，写入文件
    if (appliedEdits.length > 0) {
      await fs.writeFile(fullPath, newContent, "utf-8");
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: appliedEdits.length > 0,
              path: filePath,
              applied: appliedEdits.length,
              failed: failedEdits.length,
              appliedEdits,
              failedEdits,
              preview: newContent.substring(0, 500) + (newContent.length > 500 ? "..." : ""),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * 删除文件或目录
   */
  async deleteFile(appName: string, filePath: string, confirm: boolean) {
    if (!confirm) {
      throw new Error("删除操作需要确认，请将 confirm 参数设置为 true");
    }

    const appPath = this.appManager.getAppPath(appName);
    const fullPath = path.join(appPath, filePath);

    // 安全检查
    const resolvedPath = path.resolve(fullPath);
    const resolvedAppPath = path.resolve(appPath);
    if (!resolvedPath.startsWith(resolvedAppPath)) {
      throw new Error("非法文件路径");
    }

    if (!(await fs.pathExists(fullPath))) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    const isDirectory = (await fs.stat(fullPath)).isDirectory();

    await fs.remove(fullPath);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              message: `${isDirectory ? "目录" : "文件"}已删除: ${filePath}`,
              path: filePath,
              type: isDirectory ? "directory" : "file",
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * 上传本地文件到应用
   */
  async uploadFile(appName: string, localPath: string, targetPath: string) {
    // 检查本地文件是否存在
    if (!(await fs.pathExists(localPath))) {
      throw new Error(`本地文件不存在: ${localPath}`);
    }

    const appPath = this.appManager.getAppPath(appName);
    const fullTargetPath = path.join(appPath, targetPath);

    // 安全检查
    const resolvedPath = path.resolve(fullTargetPath);
    const resolvedAppPath = path.resolve(appPath);
    if (!resolvedPath.startsWith(resolvedAppPath)) {
      throw new Error("非法目标路径");
    }

    // 确保目标目录存在
    await fs.ensureDir(path.dirname(fullTargetPath));

    // 复制文件
    await fs.copy(localPath, fullTargetPath);

    const stat = await fs.stat(fullTargetPath);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              message: `文件已上传`,
              localPath,
              targetPath,
              size: stat.size,
            },
            null,
            2
          ),
        },
      ],
    };
  }
}
