import path from "path";
import fs from "fs-extra";

export class I18nManager {
  private appManager: any;

  constructor(appManager: any) {
    this.appManager = appManager;
  }

  /**
   * 列出应用的国际化文件
   */
  async listI18nFiles(appName: string) {
    const appPath = this.appManager.getAppPath(appName);

    if (!(await fs.pathExists(appPath))) {
      throw new Error(`应用不存在: ${appName}`);
    }

    const i18nFiles: any[] = [];
    const searchPaths = [
      path.join(appPath, "app", "web", "i18n"),
      path.join(appPath, "app", "web", "lang"),
      path.join(appPath, "i18n"),
      path.join(appPath, "lang"),
    ];

    for (const searchPath of searchPaths) {
      if (await fs.pathExists(searchPath)) {
        const files = await fs.readdir(searchPath);
        for (const file of files) {
          if (file.endsWith(".js") || file.endsWith(".json") || file.endsWith(".ts")) {
            const fullPath = path.join(searchPath, file);
            const stat = await fs.stat(fullPath);

            // 尝试解析语言代码
            const langCode = this.extractLangCode(file);

            i18nFiles.push({
              name: file,
              path: path.relative(appPath, fullPath).replace(/\\/g, "/"),
              language: langCode,
              size: stat.size,
              modified: stat.mtime,
            });
          }
        }
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              appName,
              count: i18nFiles.length,
              files: i18nFiles,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * 从文件名提取语言代码
   */
  private extractLangCode(filename: string): string {
    const baseName = path.basename(filename, path.extname(filename));
    // 常见格式: en-US.js, zh-CN.json, etc.
    const match = baseName.match(/[a-z]{2}(-[A-Z]{2})?/);
    return match ? match[0] : baseName;
  }

  /**
   * 编辑国际化内容
   */
  async editI18n(appName: string, language: string, translations: Record<string, string>) {
    const appPath = this.appManager.getAppPath(appName);

    if (!(await fs.pathExists(appPath))) {
      throw new Error(`应用不存在: ${appName}`);
    }

    // 查找 i18n 文件
    const i18nFile = await this.findI18nFile(appPath, language);

    if (!i18nFile) {
      throw new Error(`未找到语言 "${language}" 的国际化文件`);
    }

    // 读取现有翻译
    let i18nContent: Record<string, any> = {};

    try {
      const content = await fs.readFile(i18nFile.path, "utf-8");
      if (i18nFile.format === "json") {
        i18nContent = JSON.parse(content);
      } else if (i18nFile.format === "js") {
        // 尝试解析 JS 模块
        i18nContent = this.parseJsModule(content);
      }
    } catch (e) {
      // 文件可能为空或格式错误，从头开始
      i18nContent = {};
    }

    // 更新翻译
    const addedKeys: string[] = [];
    const updatedKeys: string[] = [];

    for (const [key, value] of Object.entries(translations)) {
      if (!this.hasNestedKey(i18nContent, key)) {
        addedKeys.push(key);
      } else {
        updatedKeys.push(key);
      }
      this.setNestedKey(i18nContent, key, value);
    }

    // 写回文件
    let newContent: string;
    if (i18nFile.format === "json") {
      newContent = JSON.stringify(i18nContent, null, 2) + "\n";
    } else {
      newContent = this.serializeJsModule(i18nContent);
    }

    await fs.writeFile(i18nFile.path, newContent, "utf-8");

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              message: `国际化内容已更新`,
              appName,
              language,
              file: i18nFile.relativePath,
              added: addedKeys.length,
              updated: updatedKeys.length,
              addedKeys,
              updatedKeys,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * 查找 i18n 文件
   */
  private async findI18nFile(appPath: string, language: string): Promise<{
    path: string;
    format: "json" | "js";
    relativePath: string;
  } | null> {
    const searchPaths = [
      path.join(appPath, "app", "web", "i18n"),
      path.join(appPath, "app", "web", "lang"),
      path.join(appPath, "i18n"),
      path.join(appPath, "lang"),
    ];

    const possibleNames = [
      `${language}.js`,
      `${language}.json`,
      `${language}.ts`,
    ];

    for (const searchPath of searchPaths) {
      if (await fs.pathExists(searchPath)) {
        for (const name of possibleNames) {
          const fullPath = path.join(searchPath, name);
          if (await fs.pathExists(fullPath)) {
            return {
              path: fullPath,
              format: name.endsWith(".json") ? "json" : "js",
              relativePath: path.relative(appPath, fullPath).replace(/\\/g, "/"),
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * 解析 JS 模块（简单实现）
   */
  private parseJsModule(content: string): Record<string, any> {
    try {
      // 尝试匹配 export default {...}
      const match = content.match(/export\s+default\s+(\{[\s\S]*\});?/);
      if (match) {
        // 将 JS 对象转为 JSON 字符串再解析
        const jsonStr = match[1]
          .replace(/(\w+):/g, '"$1":')  // 添加引号到键
          .replace(/'/g, '"');           // 统一引号
        return JSON.parse(jsonStr);
      }
    } catch (e) {
      // 解析失败
    }
    return {};
  }

  /**
   * 序列化为 JS 模块
   */
  private serializeJsModule(obj: Record<string, any>): string {
    const json = JSON.stringify(obj, null, 2);
    return `export default ${json};\n`;
  }

  /**
   * 检查是否包含嵌套键（支持 a.b.c 格式）
   */
  private hasNestedKey(obj: any, keyPath: string): boolean {
    const keys = keyPath.split(".");
    let current = obj;

    for (const key of keys) {
      if (current && typeof current === "object" && key in current) {
        current = current[key];
      } else {
        return false;
      }
    }

    return true;
  }

  /**
   * 设置嵌套键值
   */
  private setNestedKey(obj: any, keyPath: string, value: any): void {
    const keys = keyPath.split(".");
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== "object") {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }
}
