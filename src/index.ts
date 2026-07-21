import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { AppManager } from "./tools/app-manager.js";
import { FileEditor } from "./tools/file-editor.js";
import { ConfigEditor } from "./tools/config-editor.js";
import { FpkBuilder } from "./tools/builder.js";
import { I18nManager } from "./tools/i18n-manager.js";
import { Validator } from "./tools/validator.js";
import path from "path";
import fs from "fs-extra";

class FpkPackagerServer {
  private server: Server;
  private appManager: AppManager;
  private fileEditor: FileEditor;
  private configEditor: ConfigEditor;
  private fpkBuilder: FpkBuilder;
  private i18nManager: I18nManager;
  private validator: Validator;

  constructor() {
    // 初始化各个模块
    this.appManager = new AppManager();
    this.fileEditor = new FileEditor(this.appManager);
    this.configEditor = new ConfigEditor(this.appManager);
    this.fpkBuilder = new FpkBuilder(this.appManager);
    this.i18nManager = new I18nManager(this.appManager);
    this.validator = new Validator(this.appManager);

    // 创建 MCP 服务器
    this.server = new Server(
      {
        name: "mcp-fpk-packager",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // 工具列表
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getTools(),
    }));

    // 工具调用
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        return await this.callTool(name, args);
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `错误: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });

    // 资源列表
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: this.getResources(),
    }));

    // 读取资源
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      return await this.readResource(uri);
    });

    // 提示词列表
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: this.getPrompts(),
    }));

    // 获取提示词
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      return await this.getPrompt(name, args);
    });
  }

  private getTools() {
    return [
      // 应用管理工具
      {
        name: "list_applications",
        description: "列出所有 fpk 应用",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "create_application",
        description: "创建新的 fpk 应用",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "应用名称（只能包含字母、数字、连字符和下划线）",
            },
            type: {
              type: "string",
              enum: ["native", "docker"],
              description: "应用类型：native(原生应用) 或 docker(Docker应用)",
            },
            description: {
              type: "string",
              description: "应用描述（可选）",
            },
          },
          required: ["name", "type"],
        },
      },
      {
        name: "import_fpk",
        description: "导入现有的 .fpk 文件",
        inputSchema: {
          type: "object",
          properties: {
            fpk_path: {
              type: "string",
              description: ".fpk 文件的完整路径",
            },
            target_name: {
              type: "string",
              description: "导入后的应用名称（可选，默认使用原文件名）",
            },
          },
          required: ["fpk_path"],
        },
      },
      {
        name: "open_application",
        description: "打开应用查看其结构和状态",
        inputSchema: {
          type: "object",
          properties: {
            app_name: {
              type: "string",
              description: "应用名称",
            },
          },
          required: ["app_name"],
        },
      },
      {
        name: "delete_application",
        description: "删除应用",
        inputSchema: {
          type: "object",
          properties: {
            app_name: {
              type: "string",
              description: "要删除的应用名称",
            },
            confirm: {
              type: "boolean",
              description: "确认删除（必须为 true）",
            },
          },
          required: ["app_name", "confirm"],
        },
      },

      // 文件编辑工具
      {
        name: "list_files",
        description: "列出应用目录结构",
        inputSchema: {
          type: "object",
          properties: {
            app_name: {
              type: "string",
              description: "应用名称",
            },
            path: {
              type: "string",
              description: "相对路径（默认根目录）",
            },
            recursive: {
              type: "boolean",
              description: "是否递归列出所有文件",
            },
          },
          required: ["app_name"],
        },
      },
      {
        name: "read_file",
        description: "读取文件内容",
        inputSchema: {
          type: "object",
          properties: {
            app_name: {
              type: "string",
              description: "应用名称",
            },
            file_path: {
              type: "string",
              description: "相对文件路径",
            },
          },
          required: ["app_name", "file_path"],
        },
      },
      {
        name: "write_file",
        description: "写入或创建文件",
        inputSchema: {
          type: "object",
          properties: {
            app_name: {
              type: "string",
              description: "应用名称",
            },
            file_path: {
              type: "string",
              description: "相对文件路径",
            },
            content: {
              type: "string",
              description: "文件内容",
            },
            encoding: {
              type: "string",
              description: "文件编码（默认 utf-8）",
            },
          },
          required: ["app_name", "file_path", "content"],
        },
      },
      {
        name: "edit_file",
        description: "智能编辑文件（基于旧文本替换）",
        inputSchema: {
          type: "object",
          properties: {
            app_name: {
              type: "string",
              description: "应用名称",
            },
            file_path: {
              type: "string",
              description: "相对文件路径",
            },
            edits: {
              type: "array",
              description: "编辑操作列表",
              items: {
                type: "object",
                properties: {
                  old_string: {
                    type: "string",
                    description: "要替换的文本",
                  },
                  new_string: {
                    type: "string",
                    description: "新文本",
                  },
                },
                required: ["old_string", "new_string"],
              },
            },
          },
          required: ["app_name", "file_path", "edits"],
        },
      },
      {
        name: "delete_file",
        description: "删除文件或目录",
        inputSchema: {
          type: "object",
          properties: {
            app_name: {
              type: "string",
              description: "应用名称",
            },
            file_path: {
              type: "string",
              description: "相对文件路径",
            },
            confirm: {
              type: "boolean",
              description: "确认删除（必须为 true）",
            },
          },
          required: ["app_name", "file_path", "confirm"],
        },
      },
      {
        name: "upload_file",
        description: "上传本地文件到应用（原生应用）",
        inputSchema: {
          type: "object",
          properties: {
            app_name: {
              type: "string",
              description: "应用名称",
            },
            local_path: {
              type: "string",
              description: "本地文件完整路径",
            },
            target_path: {
              type: "string",
              description: "应用内的目标路径",
            },
          },
          required: ["app_name", "local_path", "target_path"],
        },
      },

      // 配置编辑工具
      {
        name: "edit_manifest",
        description: "编辑 manifest 配置文件",
        inputSchema: {
          type: "object",
          properties: {
            app_name: {
              type: "string",
              description: "应用名称",
            },
            updates: {
              type: "object",
              description: "要更新的 manifest 字段",
            },
          },
          required: ["app_name", "updates"],
        },
      },
      {
        name: "edit_env",
        description: "编辑环境变量配置",
        inputSchema: {
          type: "object",
          properties: {
            app_name: {
              type: "string",
              description: "应用名称",
            },
            env_vars: {
              type: "object",
              description: "环境变量键值对",
            },
          },
          required: ["app_name", "env_vars"],
        },
      },
      {
        name: "edit_docker_compose",
        description: "编辑 Docker Compose 配置",
        inputSchema: {
          type: "object",
          properties: {
            app_name: {
              type: "string",
              description: "应用名称",
            },
            content: {
              type: "string",
              description: "docker-compose.yaml 完整内容",
            },
          },
          required: ["app_name", "content"],
        },
      },

      // 打包工具
      {
        name: "build_fpk",
        description: "打包应用为 .fpk 文件",
        inputSchema: {
          type: "object",
          properties: {
            app_name: {
              type: "string",
              description: "应用名称",
            },
            output_path: {
              type: "string",
              description: "输出路径（可选，默认应用目录）",
            },
          },
          required: ["app_name"],
        },
      },

      // 国际化工具
      {
        name: "list_i18n_files",
        description: "列出应用的国际化文件",
        inputSchema: {
          type: "object",
          properties: {
            app_name: {
              type: "string",
              description: "应用名称",
            },
          },
          required: ["app_name"],
        },
      },
      {
        name: "edit_i18n",
        description: "编辑国际化翻译内容",
        inputSchema: {
          type: "object",
          properties: {
            app_name: {
              type: "string",
              description: "应用名称",
            },
            language: {
              type: "string",
              description: "语言代码（如 en-US, zh-CN）",
            },
            translations: {
              type: "object",
              description: "翻译字典",
            },
          },
          required: ["app_name", "language", "translations"],
        },
      },

      // 验证工具
      {
        name: "validate_application",
        description: "验证应用配置是否正确",
        inputSchema: {
          type: "object",
          properties: {
            app_name: {
              type: "string",
              description: "应用名称",
            },
          },
          required: ["app_name"],
        },
      },
    ];
  }

  private async callTool(name: string, args: any) {
    switch (name) {
      // 应用管理
      case "list_applications":
        return await this.appManager.listApplications();
      case "create_application":
        return await this.appManager.createApplication(args.name, args.type, args.description);
      case "import_fpk":
        return await this.appManager.importFpk(args.fpk_path, args.target_name);
      case "open_application":
        return await this.appManager.openApplication(args.app_name);
      case "delete_application":
        return await this.appManager.deleteApplication(args.app_name, args.confirm);

      // 文件编辑
      case "list_files":
        return await this.fileEditor.listFiles(args.app_name, args.path, args.recursive);
      case "read_file":
        return await this.fileEditor.readFile(args.app_name, args.file_path);
      case "write_file":
        return await this.fileEditor.writeFile(args.app_name, args.file_path, args.content, args.encoding);
      case "edit_file":
        return await this.fileEditor.editFile(args.app_name, args.file_path, args.edits);
      case "delete_file":
        return await this.fileEditor.deleteFile(args.app_name, args.file_path, args.confirm);
      case "upload_file":
        return await this.fileEditor.uploadFile(args.app_name, args.local_path, args.target_path);

      // 配置编辑
      case "edit_manifest":
        return await this.configEditor.editManifest(args.app_name, args.updates);
      case "edit_env":
        return await this.configEditor.editEnv(args.app_name, args.env_vars);
      case "edit_docker_compose":
        return await this.configEditor.editDockerCompose(args.app_name, args.content);

      // 打包
      case "build_fpk":
        return await this.fpkBuilder.buildFpk(args.app_name, args.output_path);

      // 国际化
      case "list_i18n_files":
        return await this.i18nManager.listI18nFiles(args.app_name);
      case "edit_i18n":
        return await this.i18nManager.editI18n(args.app_name, args.language, args.translations);

      // 验证
      case "validate_application":
        return await this.validator.validateApplication(args.app_name);

      default:
        throw new Error(`未知工具: ${name}`);
    }
  }

  private getResources() {
    return [
      {
        uri: "project://structure",
        name: "项目结构",
        description: "完整的 fnpackup 项目结构",
        mimeType: "application/json",
      },
      {
        uri: "project://dependencies",
        name: "项目依赖",
        description: "后端和前端依赖信息",
        mimeType: "application/json",
      },
      {
        uri: "docs://manifest-spec",
        name: "Manifest 规范",
        description: "manifest 配置文件的完整规范",
        mimeType: "text/markdown",
      },
      {
        uri: "docs://packaging-guide",
        name: "打包指南",
        description: "FPK 打包完整指南",
        mimeType: "text/markdown",
      },
    ];
  }

  private async readResource(uri: string) {
    switch (uri) {
      case "project://structure":
        return await this.getProjectStructure();
      case "project://dependencies":
        return await this.getProjectDependencies();
      case "docs://manifest-spec":
        return { contents: [{ uri, text: this.getManifestSpec() }] };
      case "docs://packaging-guide":
        return { contents: [{ uri, text: this.getPackagingGuide() }] };
      default:
        throw new Error(`未知资源: ${uri}`);
    }
  }

  private async getProjectStructure() {
    const structure = {
        backend: "fnpackup/",
        frontend: "fnpackup.web/",
        config: {
          httpPort: 1069,
          httpsPort: 10699,
          configFile: "fnpackup/appsettings.json"
        },
        directories: {
          projects: "./projects/",
          statics: "./statics/",
          apps: "./apps/"
        }
    };
    return { contents: [{ uri: "project://structure", text: JSON.stringify(structure, null, 2) }] };
  }

  private async getProjectDependencies() {
    const deps = {
      backend: {
        framework: ".NET 8.0",
        sdk: "Microsoft.AspNetCore.App",
        externalTools: ["fnpack.exe"]
      },
      frontend: {
        framework: "Vue 3.2",
        ui: "Element Plus 2.12",
        editor: "CodeMirror 6",
        i18n: "vue-i18n 9.14",
        terminal: "Xterm.js 6.0",
        build: "Vue CLI 5"
      }
    };
    return { contents: [{ uri: "project://dependencies", text: JSON.stringify(deps, null, 2) }] };
  }

  private getManifestSpec() {
    return `# FPK Manifest 规范

Manifest 是 FPK 包的核心配置文件，位于应用根目录，无扩展名。

## 必需字段

### appname
- **类型**: string
- **描述**: 应用唯一标识符
- **示例**: \`my-awesome-app\`

### name
- **类型**: string
- **描述**: 应用显示名称
- **示例**: \`我的超棒应用\`

### version
- **类型**: string
- **描述**: 应用版本号（语义化版本）
- **示例**: \`1.0.0\`

### description
- **类型**: string
- **描述**: 应用简短描述

### type
- **类型**: string
- **可选值**: \`native\` | \`docker\`
- **描述**: 应用类型

### author
- **类型**: string
- **描述**: 作者信息

## 可选字段

### icon
- **类型**: string
- **描述**: 图标文件路径（相对于应用根目录）

### entry
- **类型**: string
- **描述**: 启动入口（原生应用）

### port
- **类型**: number
- **描述**: 应用端口号

### auto_start
- **类型**: boolean
- **描述**: 是否开机自启

### privileged
- **类型**: boolean
- **描述**: Docker 应用是否需要特权模式

### fnpackup
- **类型**: string
- **描述**: 静态资源目录（用于静态托管）
- **示例**: \`www\` 或 \`dist/public\`

## 完整示例

\`\`\`
appname=my-app
name=我的应用
version=1.0.0
description=这是一个示例应用
type=native
author=snltty
icon=icon.png
entry=server.js
port=8080
auto_start=true
\`\`\`

## Docker 应用示例

\`\`\`
appname=my-docker-app
name=Docker应用
version=1.0.0
description=Docker容器应用
type=docker
author=snltty
privileged=false
\`\`\`
`;
  }

  private getPackagingGuide() {
    return `# FPK 打包完整指南

## 打包流程

### 1. 创建应用

选择应用类型：
- **Native（原生应用）**: 直接运行的程序（Node.js、Python、Go等）
- **Docker（容器应用）**: 使用 Docker Compose 部署

### 2. 准备应用文件

#### Native 应用结构
\`\`\`
app-name/
├── manifest              # 应用配置（必需）
├── app/
│   ├── server/          # 服务端程序
│   │   ├── server.js    # 主程序
│   │   └── package.json # Node.js 依赖
│   └── web/             # Web界面（可选）
│       ├── index.html
│       └── ...
\`\`\`

#### Docker 应用结构
\`\`\`
app-name/
├── manifest              # 应用配置（必需）
└── app/
    └── docker/
        └── docker-compose.yaml  # Docker配置
\`\`\`

### 3. 配置 Manifest

编辑 \`manifest\` 文件，配置应用基本信息。参见 \`docs://manifest-spec\`

### 4. 编辑应用

使用编辑工具：
- \`write_file\`: 创建新文件
- \`edit_file\`: 修改现有文件
- \`upload_file\`: 上传本地文件（原生应用）

### 5. 验证应用

使用 \`validate_application\` 检查配置是否正确。

### 6. 打包

使用 \`build_fpk\` 生成 .fpk 文件。

## 常见场景

### 创建 Node.js 应用

1. \`create_application("my-node-app", "native")\`
2. \`write_file("my-node-app", "app/server/package.json", '{"name":"app","version":"1.0.0","main":"server.js"}') \`
3. \`write_file("my-node-app", "app/server/server.js", 'const http = require("http");...') \`
4. \`edit_manifest("my-node-app", {"entry": "server.js", "port": 3000})\`
5. \`build_fpk("my-node-app")\`

### 创建 Docker 应用

1. \`create_application("my-docker-app", "docker")\`
2. \`edit_docker_compose("my-docker-app", "version: '3'\\nservices:\\n  app:\\n    image: nginx:alpine")\`
3. \`edit_manifest("my-docker-app", {"port": 80})\`
4. \`build_fpk("my-docker-app")\`

### 导入并修改现有 fpk

1. \`import_fpk("/path/to/app.fpk", "imported-app")\`
2. \`list_files("imported-app")\`
3. 使用 \`read_file\` 查看并理解现有代码
4. 使用 \`edit_file\` 进行修改
5. \`build_fpk("imported-app")\`

## 最佳实践

1. **验证先行**: 打包前使用 \`validate_application\` 检查配置
2. **增量编辑**: 优先使用 \`edit_file\` 而不是全量替换
3. **备份重要文件**: 修改前确认已有备份
4. **测试运行**: 打包后在实际环境中测试

## 故障排除

### 打包失败
- 检查 manifest 格式是否正确
- 确认所有必需文件存在
- 查看错误日志

### 文件路径错误
- 使用 \`list_files\` 确认实际路径
- 路径区分大小写

### 权限问题
- 确保 \`./projects/\` 目录可写
- 检查文件锁
`;
  }

  private getPrompts() {
    return [
      {
        name: "create-native-app",
        description: "完整创建原生应用的引导流程",
        arguments: {
          properties: {
            app_name: {
              type: "string",
              description: "应用名称",
            },
            description: {
              type: "string",
              description: "应用描述",
            },
          },
          required: ["app_name"],
        },
      },
      {
        name: "create-docker-app",
        description: "完整创建 Docker 应用的引导流程",
        arguments: {
          properties: {
            app_name: {
              type: "string",
              description: "应用名称",
            },
            description: {
              type: "string",
              description: "应用描述",
            },
          },
          required: ["app_name"],
        },
      },
      {
        name: "import-and-modify",
        description: "导入并修改现有 fpk 文件的引导流程",
        arguments: {
          properties: {
            fpk_path: {
              type: "string",
              description: ".fpk 文件路径",
            },
          },
          required: ["fpk_path"],
        },
      },
    ];
  }

  private async getPrompt(name: string, args: any) {
    switch (name) {
      case "create-native-app":
        return {
          description: "创建原生应用的完整流程",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `请帮我创建一个名为 "${args.app_name}" 的原生应用。${args.description ? `描述：${args.description}` : ""}

请按以下步骤操作：
1. 使用 create_application 创建应用（type: "native"）
2. 使用 open_application 查看应用结构
3. 根据应用需求创建必要的文件
4. 使用 edit_manifest 编辑应用配置
5. 使用 validate_application 验证配置
6. 使用 build_fpk 打包应用

如果用户没有指定具体功能，请先询问需要创建什么类型的应用（如 Node.js Web 服务、Python API 等）。`,
              },
            },
          ],
        };

      case "create-docker-app":
        return {
          description: "创建 Docker 应用的完整流程",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `请帮我创建一个名为 "${args.app_name}" 的 Docker 应用。${args.description ? `描述：${args.description}` : ""}

请按以下步骤操作：
1. 使用 create_application 创建应用（type: "docker"）
2. 使用 edit_docker_compose 创建 docker-compose.yaml
3. 使用 edit_manifest 编辑应用配置
4. 使用 validate_application 验证配置
5. 使用 build_fpk 打包应用

请询问用户需要部署什么服务（如 Nginx、数据库、应用服务等），然后创建相应的 docker-compose 配置。`,
              },
            },
          ],
        };

      case "import-and-modify":
        return {
          description: "导入并修改现有 fpk",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `请帮我导入并修改 fpk 文件：${args.fpk_path}

请按以下步骤操作：
1. 使用 import_fpk 导入文件
2. 使用 open_application 查看应用结构
3. 使用 list_files 浏览所有文件
4. 使用 read_file 阅读源代码，理解应用结构
5. 询问用户需要做哪些修改
6. 使用 edit_file 或 write_file 进行修改
7. 使用 validate_application 验证
8. 使用 build_fpk 重新打包

请先导入文件，然后向我展示应用结构，最后询问需要做哪些修改。`,
              },
            },
          ],
        };

      default:
        throw new Error(`未知提示词: ${name}`);
    }
  }

  async run() {
    // 确保项目根目录存在
    const projectsDir = path.join(process.cwd(), "..", "projects");
    await fs.ensureDir(projectsDir);

    // 使用 stdio 传输
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("FPK Packager MCP Server 运行中...");
  }
}

// 启动服务器
const server = new FpkPackagerServer();
server.run().catch((error) => {
  console.error("服务器错误:", error);
  process.exit(1);
});
