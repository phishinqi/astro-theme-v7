# 图片存储与 R2

后台支持三种图片存储方式：博客仓库固定目录、R2 Bucket、独立 GitHub 媒体仓库。图片先在浏览器中编码为 WebP，成功写入目标存储后才更新图片字段。失败时保留原字段值并显示错误。相册中已声明的宽高、主色和 srcset 随上传结果更新。

本功能从 v7-cms v0.2.0 起提供，主题已固定引用该版本。构建时优先使用 `V7_CMS` 指定路径或同级 CMS 构建；没有本地构建时下载 v0.2.0 的 GitHub Release。原图请自行归档。

## 配置入口

`cms.config.json` 的 `media` 是后台媒体配置来源。`pnpm cms:config` / `pnpm build` 生成生产版 `cms.config.github.json` 时，可以用下列构建环境变量覆盖。不要直接编辑生成文件。

| 变量               | 作用                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------- |
| `MEDIA_PROVIDER`   | `repo`、`r2` 或 `github`                                                                |
| `MEDIA_PATH`       | 仓库内固定目录；同仓库默认 `public/images/uploads`，通过变量选择独立仓库时默认 `images` |
| `MEDIA_PUBLIC_URL` | 与上述目录对应的公开 URL 前缀，同仓库可为 `/images/uploads`，独立仓库必须为 HTTPS 地址  |
| `MEDIA_REPO`       | 独立图片仓库 `owner/repo`，只用于 `github` 模式                                         |
| `MEDIA_BRANCH`     | 独立图片仓库分支，默认 `main`                                                           |
| `MEDIA_ENDPOINT`   | R2 上传 API，默认 `/api/media`                                                          |

变量在构建时生效，更改后重新构建部署。显式设置 `MEDIA_PROVIDER` 会清除旧的集合级媒体覆盖，让所有集合使用该部署目标。没有设置时保留 CMS 配置。主题默认已移除相册的路径覆盖，所有图片写入固定目录。

`site.config.json` 的旧 `media.provider` 和 `exifPrefill` 不控制后台上传，请在 CMS 配置或上述构建变量中选择存储。站点默认许可仍由 `site.config.json` 管理。

## 1. 博客仓库固定目录

默认无需额外变量，CMS 配置如下：

```json
{
  "media": {
    "provider": "repo",
    "repoPath": "public/images/uploads",
    "publicPath": "/images/uploads",
    "maxEdge": 2400
  }
}
```

线上通过已连接的 GitHub 内容后端写入博客仓库；本地模式写入选中的博客文件夹或代理服务的工作目录。图片 URL 随博客部署后可公开访问，上传后尚未部署的本地路径在远程预览中可能暂时 404。已有图片不会随配置切换自动迁移。

## 2. R2 Bucket

构建变量设置 `MEDIA_PROVIDER=r2`，`MEDIA_ENDPOINT=/api/media`。也可以在 CMS 配置中直接设置：

```json
{ "media": { "provider": "r2", "endpoint": "/api/media" } }
```

1. 在 Cloudflare 创建 R2 bucket，为图片配置公开 HTTPS 地址，正式使用建议绑定图片自定义域名。
2. 在 Pages 的 Settings → Bindings 添加 R2 绑定，名称为 `MEDIA`，选择该 bucket。
3. 设置运行时变量 `PUBLIC_MEDIA_URL=https://img.example.com`，不要带 `/images` 后缀。接口生成 `https://img.example.com/images/<id>/<width>.webp`。
4. 设置 `GITHUB_REPO` 为博客仓库。接口使用登录令牌检查该仓库的写权限；`MEDIA_REPO` 不参与 R2 鉴权。
5. 通过 GitHub 后端登录。个人令牌无需 OAuth 服务；使用 OAuth 时还需 `GITHUB_CLIENT_ID` 和 Secret 类型的 `GITHUB_CLIENT_SECRET`，见[后台登录](cms.md#线上登录oauth-配置)。重新部署后上传图片验证。

浏览器将最多四个 WebP 宽度变体发送给主题 `/api/media`，Pages Function 通过 `MEDIA` 绑定写入 bucket，并返回 URL、尺寸和 srcset。R2 写入凭据不进入浏览器。接口限制整个请求不超过 16 MB。配置示例见 `wrangler.example.toml`；生产与预览环境分别核对变量和绑定。

图片读取走公开域名，不经过媒体接口。`GET /api/media` 读取 `meta/` 索引，`POST` 写入 `images/` 和 `meta/`；手动放入 bucket 的对象不会自动加入该索引。本次提供上传，不新增媒体库浏览或删除界面。

主题接口目前只允许同域请求。CMS 可以配置 HTTPS 的独立 endpoint，但独立服务必须自行实现相同的 multipart 接口、令牌鉴权及 CORS/OPTIONS；主题现有接口不能直接跨域使用。媒体 endpoint 是接收 GitHub 令牌的可信服务，不是 R2 的 S3 地址。

## 3. 独立 Media Repo

在构建环境中设置：

```text
MEDIA_PROVIDER=github
MEDIA_REPO=your-name/blog-media
MEDIA_BRANCH=main
MEDIA_PATH=images
MEDIA_PUBLIC_URL=https://img.example.com/images
```

对应 CMS 配置：

```json
{
  "media": {
    "provider": "github",
    "repo": "your-name/blog-media",
    "branch": "main",
    "repoPath": "images",
    "publicPath": "https://img.example.com/images"
  }
}
```

CMS 直接通过 GitHub API 向媒体仓库的指定分支提交 WebP，文章仍保存在博客仓库。先创建仓库和分支；登录令牌需要两个仓库的 Contents 读写权限。Fine-grained PAT 需勾选两个仓库；若跨仓库所有者的权限无法由同一令牌覆盖，需要调整授权方案，本实现使用当前登录的同一个令牌。

媒体仓库还需要公开托管，例如部署为静态图片站并绑定图片域名。`MEDIA_PUBLIC_URL` 对应 `MEDIA_PATH` 目录，不是 GitHub 仓库网页地址，也不是秘密令牌链接。仓库为私有并不意味着其中的图片可以直接被访客读取。图片可访问时间取决于媒体站点部署完成时间。

## 本地联调与验收

本地默认使用文件夹模式；R2 和独立媒体仓库需要 GitHub 登录令牌，因此联调时将本地 CMS 的 backend 也切换为 GitHub。`astro dev` 不会运行 Cloudflare Pages Functions；R2 应使用运行了 Functions 的同域 Pages 环境。构建变量只覆盖生产配置，不会悄悄让本地文件夹写作向远程上传。

验证三种方式时，分别确认目标目录、bucket 或独立仓库确实存在新图片；独立模式没有向博客仓库写入图片；字段 URL、尺寸正确；保存文章并完成部署后图片可访问。模拟接口测试不替代真实 GitHub / R2 联调。

图片在点击上传时写入，文章随后保存。取消编辑不会自动删除已上传图片；删除列表项也不会删除共享图片。切换存储不迁移旧资源，保留原 URL 或另行复制并更新 src/srcset，确认引用已迁移后再清理旧资源。
