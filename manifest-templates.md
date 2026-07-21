# FPK 应用清单 (Manifest)

这是 FPK 应用的 manifest 配置文件模板。

## 基本信息

```
appname=your-app-name
name=应用显示名称
version=1.0.0
description=简短的应用描述
type=native
author=你的名字
```

## Native 应用（原生程序）

### Node.js Web 服务

```
appname=my-node-web
name=我的 Node.js Web 服务
version=1.0.0
description=使用 Node.js 构建的 Web 服务
type=native
author=snltty
icon=icon.png
entry=server.js
port=3000
auto_start=true
```

目录结构：
```
my-node-web/
├── manifest
└── app/
    ├── server/
    │   ├── server.js
    │   └── package.json
    └── web/
        └── index.html
```

### Python API 服务

```
appname=my-python-api
name=我的 Python API 服务
version=1.0.0
description=使用 Python 构建的 API 服务
type=native
author=snltty
entry=main.py
port=8000
auto_start=true
```

### Go 应用

```
appname=my-go-app
name=我的 Go 应用
version=1.0.0
description=使用 Go 构建的高性能应用
type=native
author=snltty
entry=app
port=8080
auto_start=true
```

## Docker 应用（容器应用）

### Nginx Web 服务器

```
appname=my-nginx
name=Nginx Web 服务器
version=1.0.0
description=静态网站和反向代理
type=docker
author=snltty
port=80
privileged=false
```

`app/docker/docker-compose.yaml`:
```yaml
version: '3.8'
services:
  nginx:
    image: nginx:alpine
    ports:
      - '80:80'
    volumes:
      - ./html:/usr/share/nginx/html:ro
    restart: unless-stopped
```

### 数据库服务

```
appname=postgres-db
name=PostgreSQL 数据库
version=1.0.0
description=PostgreSQL 数据库服务
type=docker
author=snltty
port=5432
privileged=false
```

`app/docker/docker-compose.yaml`:
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD:-mypassword}
      POSTGRES_DB: myapp
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

### Node.js + MongoDB 应用

```
appname=mern-app
name=MERN 全栈应用
version=1.0.0
description=MongoDB + Express + React + Node.js
type=docker
author=snltty
port=3000
privileged=false
```

`app/docker/docker-compose.yaml`:
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - '3000:3000'
    environment:
      - MONGODB_URI=mongodb://mongo:27017/myapp
      - NODE_ENV=production
    depends_on:
      - mongo
    restart: unless-stopped

  mongo:
    image: mongo:6-alpine
    ports:
      - '27017:27017'
    volumes:
      - mongo_data:/data/db
    restart: unless-stopped

volumes:
  mongo_data:
```

## 可选字段

### 图标

```
icon=icon.png
```

图标文件应该放在应用根目录，推荐尺寸 512x512 像素。

### 静态资源托管

如果应用包含要托管的静态内容：

```
appname=my-static-site
name=我的静态网站
version=1.0.0
description=纯静态网站
type=native
author=snltty
fnpackup=dist
```

其中 `fnpackup=dist` 表示将 `app/web/dist/` 目录作为静态资源托管。

### 权限设置

Docker 应用可能需要特权模式：

```
privileged=true  # 需要特权模式
```

仅当确实需要时才使用，出于安全考虑应该避免。

### 环境变量

应用可以包含 `.env` 文件：

```
NODE_ENV=production
PORT=3000
DB_HOST=localhost
DB_PASSWORD=secret
```

在代码中读取：
- Node.js: `process.env.PORT`
- Python: `os.environ.get('PORT')`
- Go: `os.Getenv("PORT")`

## 国际化

如果需要支持多语言，添加 i18n 目录：

```
app/web/i18n/
├── en-US.js
└── zh-CN.js
```

`en-US.js`:
```javascript
export default {
  app: {
    title: "My App",
    welcome: "Welcome"
  }
}
```

## 最佳实践

1. **版本号**: 使用语义化版本（Semantic Versioning）
   - `1.0.0`
   - `1.2.3`
   - `2.0.0-beta.1`

2. **描述**: 清晰简短地描述应用功能

3. **作者**: 提供作者信息或组织名称

4. **端口**: 避免使用保留端口
   - ❌ 避免: 80, 443, 22, 3306
   - ✅ 推荐: 3000, 8080, 8000, 8888

5. **自启动**: 仅对需要后台运行的服务开启
   - `auto_start=true` - 服务类应用
   - `auto_start=false` - 工具类、一次性任务

## 完整示例

### 生产级 Node.js 应用

```
appname=production-api
name=生产级 API 服务
version=2.1.0
description=高可用的 REST API 服务
type=native
author=snltty
icon=icon.png
entry=server.js
port=8080
auto_start=true
```

### 微服务组合

```
appname=my-microservices
name=微服务套件
version=1.0.0
description=包含 API、Worker 和定时任务
type=docker
author=snltty
port=80
privileged=false
```

`docker-compose.yaml`:
```yaml
version: '3.8'
services:
  api:
    image: myapp/api:latest
    ports:
      - '8080:8080'
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    restart: unless-stopped

  worker:
    image: myapp/worker:latest
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - '80:80'
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - api
    restart: unless-stopped
```
