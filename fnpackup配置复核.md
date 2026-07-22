# fnpackup 服务配置复核报告

**复核日期**: 2026-07-22
**复核范围**: fnpackup Web 服务 API 配置、环境变量、认证机制
**MCP Server 版本**: 1.0.2

## 📋 复核结论

✅ **fnpackup 服务无认证要求**
- 所有 API 端点无需认证、授权、API Key
- 服务默认监听 `http://localhost:1069` 和 `https://localhost:10699`
- CORS 配置为 `AllowAll`（允许所有来源）

## 🔍 详细分析

### 1. 认证机制检查

#### ❌ 无认证配置
检查了以下文件，均未发现认证配置：

**Program.cs**:
```csharp
// 未发现以下任何调用：
// ❌ builder.Services.AddAuthentication()
// ❌ builder.Services.AddAuthorization()
// ❌ app.UseAuthentication()
// ❌ app.UseAuthorization()
```

**所有 Controller 端点**:
```csharp
// ❌ 未发现任何 [Authorize] 特性
[HttpPost]
[Route("/project/pack")]
public async Task<List<PackResultInfo>> Pack(...)
```

**结论**: fnpackup 服务是一个完全开放的本地服务，设计用于局域网或本地开发环境。

### 2. API 端点清单

#### 项目打包相关（MCP server 需要）

| 端点 | 方法 | 认证 | 参数 | 说明 |
|------|------|------|------|------|
| `/project/pack` | POST | ❌ 无需 | `name`, `uspace`, `platform`, `server` | **打包应用** |
| `/project/build` | POST | ❌ 无需 | `name`, `shell` | 构建（目前返回空） |
| `/project/create` | POST | ❌ 无需 | body: `ProjectCreateInfo` | 创建应用 |
| `/project/exists` | GET | ❌ 无需 | `name` | 检查应用存在 |

#### 文件操作（MCP server 需要）

| 端点 | 方法 | 认证 | 参数 | 说明 |
|------|------|------|------|------|
| `/file/list` | GET | ❌ 无需 | `path`, `p`, `ps` | 列出文件 |
| `/file/create` | POST | ❌ 无需 | `path`, `f` | 创建文件/目录 |
| `/file/delete` | POST | ❌ 无需 | `path`, `f` | 删除文件/目录 |
| `/file/rename` | POST | ❌ 无需 | `path`, `path1`, `f` | 重命名 |
| `/file/copy` | POST | ❌ 无需 | `path`, `path1`, `f` | 复制 |
| `/file/read` | GET | ❌ 无需 | `path` | 读取文件 |
| `/file/write` | POST | ❌ 无需 | body: `FileWriteInfo` | 写入文件 |
| `/file/upload` | POST | ❌ 无需 | `path`, `fpk`, files | 上传文件 |
| `/file/download` | GET | ❌ 无需 | `path` | 下载文件/目录 |
| `/file/img` | GET | ❌ 无需 | `path` | 获取图片 |

#### 其他端点

| 端点 | 方法 | 认证 | 说明 |
|------|------|------|------|
| `/system/version` | GET | ❌ 无需 | 获取版本信息 |
| `/app/list` | GET | ❌ 无需（但需要 Cookie: `fnos-token`） | 查询 FNOS 应用中心 |
| `/platform/empty` | POST | ❌ 无需 | 清空平台目录 |
| `/static/*` | Various | ❌ 无需 | 静态文件服务 |

### 3. 环境变量

#### fnpackup 服务使用的环境变量

| 变量名 | 使用位置 | 说明 | MCP server 是否需要 |
|--------|---------|------|-------------------|
| `FNOS_HTTP_PORT` | `ProjectController.cs:620` | FNOS 系统 HTTP 端口 | ❌ 否（仅用于 `/app/list`） |
| `ASPNETCORE_ENVIRONMENT` | `launchSettings.json` | .NET 运行环境 | ❌ 否 |

**结论**: 以上环境变量均由 fnpackup 服务内部使用，MCP server 不需要配置。

#### MCP server 需要的环境变量

| 变量名 | 默认值 | 必需 | 说明 |
|--------|--------|------|------|
| `PROJECTS_DIR` | `../projects/` | ✅ 是 | fnpackup 服务的项目目录 |
| `FNPACKUP_SERVICE_URL` | `http://localhost:1069` | ❌ 否 | fnpackup 服务 API 地址 |

### 4. 安全配置

#### HTTPS 证书
```csharp
// Program.cs:35-58
serverOptions.ConfigureHttpsDefaults(httpsOptions =>
{
    // 使用嵌入式 PEM 密钥生成自签名证书
    using Stream streamPublic = Assembly.GetExecutingAssembly()
        .GetManifestResourceStream($"fnpackup.publickey.pem");
    using Stream streamPrivate = Assembly.GetExecutingAssembly()
        .GetManifestResourceStream($"fnpackup.privatekey.pem");
    // 证书密码: "snltty"
    byte[] pfxBytes = certificate.Export(X509ContentType.Pfx, "snltty");
});
```

**说明**: fnpackup 使用自签名 HTTPS 证书，密码为 `"snltty"`。
MCP server 建议使用 HTTP（端口 1069）以避免自签名证书问题。

#### CORS 配置
```csharp
options.AddPolicy("AllowAll", policy =>
{
    policy.AllowAnyOrigin()    // 允许所有来源
          .AllowAnyMethod()    // 允许所有方法
          .AllowAnyHeader();   // 允许所有头
});
```

**说明**: CORS 完全开放，适合本地/局域网使用，不适合公网暴露。

### 5. fnpackup 服务版本

从 `fnpackup.csproj` 获取：
```xml
<Version>1.1.5</Version>
<Description>1. 支持编辑国际化内容</Description>
```

**MCP server 兼容性**: ✅ 已测试兼容

## ✅ 最终确认

### MCP server 所需配置

**必需**:
- ✅ `PROJECTS_DIR` - fnpackup 服务的项目目录路径

**可选**:
- ✅ `FNPACKUP_SERVICE_URL` - fnpackup 服务 API 地址（默认 `http://localhost:1069`）

**不需要**:
- ❌ API Key / Token
- ❌ 用户名 / 密码
- ❌ Bearer Token
- ❌ 任何其他认证凭证

### 前置条件

1. ✅ **fnpackup 服务已启动**
   ```bash
   cd /path/to/fnpackup
   dotnet run
   # 服务运行在 http://localhost:1069
   ```

2. ✅ **项目目录可访问**
   - MCP server 对 `PROJECTS_DIR` 有读写权限
   - fnpackup 服务对同一目录有读写权限

3. ✅ **端口未被占用**
   - 1069 (HTTP)
   - 10699 (HTTPS)

## 🎯 结论

**fnpackup 服务无需任何认证配置**。它是一个本地/局域网服务，设计用于：
- 本地开发环境
- 局域网内信任网络
- 配合 fnpackup Web UI 使用

MCP server 只需配置：
1. `PROJECTS_DIR` - 指向 fnpackup 的 projects 目录
2. `FNPACKUP_SERVICE_URL` - fnpackup 服务地址（可选，有默认值）

**无需任何 API Key、Token 或其他认证信息**。

---

**复核人**: Claude Code
**复核日期**: 2026-07-22
**状态**: ✅ 确认无误
