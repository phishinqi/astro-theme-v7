# 写作后台与图片存储

## 本地写作

1. 安装依赖，运行 `pnpm dev`。
2. 另一个终端在同一项目根目录运行 `pnpm cms:local`。
3. 打开 `http://localhost:4321/admin/`，选择本地登录。

本地代理只在 loopback 页面启用，不要暴露代理端口到公网。它直接读写本地文件，不模拟 GitHub 的分支草稿流程。现有 `draft: true` 文章仍被博客构建排除。完整草稿分支与发布流程需未来连接 GitHub 后联调。

文章分成 Markdown 和 MDX 两个入口，都递归读取 `content/posts/`。文件路径仅管理存放位置，不决定分类或公开链接。Markdown 普通内容支持可视化与源码模式；含公式、Mermaid、HTML 或 MDX 的内容自动使用源码模式。MDX 始终使用源码编辑；后台不执行任意 MDX 导入，复杂内容请用本地站点检查。

编辑器预览使用 Decap 渲染，不等同完整 Astro 页面。不要通过可视化编辑器重新序列化未经验证的复杂 Markdown。

## GitHub 登录与发布

未来上线时设置 `site.config.json` 的 `cms.repo`、`cms.branch`、`cms.authURL`。当前主题预填 `phishinqi/astro-theme-v7`，不会自动创建仓库或连接账号。

配套 Worker 的 `/auth` 发起 GitHub OAuth，`/callback` 校验 OAuth state，并检查用户对指定仓库的写权限。GitHub OAuth App 的回调地址填写 `https://你的-worker域名/callback`。在 Worker 环境配置 `SITE_ORIGIN`、`GITHUB_REPO`、`GITHUB_CLIENT_ID`，使用平台 Secret 保存 `GITHUB_CLIENT_SECRET`。

生产后台使用 Decap editorial workflow：保存草稿写入独立分支，发布才合并到发布分支。内容中的 `draft` 是额外的构建排除标记；发布前必须关闭并保存，后台会阻止发布仍带有该标记的内容。未来日期仍需到期重新构建，不包含自动定时发布。

公开仓库的草稿分支也公开。本主题仓库只放演示内容；真实私密草稿应存到使用者自己的私有仓库。关闭托管平台对草稿分支的公开预览构建。

## 图片模式 A：GitHub 仓库

默认 `media.provider: "github"`。使用 Decap 内置媒体库上传到 `public/images/uploads/`，公开路径为 `/images/uploads/`。无需 R2。封面和画廊的本地栅格图片由 Astro 在构建阶段生成 WebP 响应式图片。

填写图片的替代文本、宽高以及可选说明。MDX 中推荐使用 `@components/MediaImage.astro` 或 `@components/Gallery.astro`；普通 Markdown 图片仍可使用，但不要上传超大原图直接供网页下载。

## 图片模式 B：Cloudflare R2

设置 `media.provider: "r2"` 与 `media.workerURL`、`media.publicURL`，并配置 Worker 的 `MEDIA` R2 绑定及 `PUBLIC_MEDIA_URL`。GitHub-only 模式的 OAuth Worker 不需要 R2 绑定；R2 模式需要。

图片库使用当前 GitHub 登录令牌访问 Worker，Worker 每次验证指定仓库写权限并限制请求 Origin。R2 凭据通过绑定提供，不进入客户端。后台支持上传、选择已有图片和分页浏览；没有开放删除对象接口，防止删除仍被文章引用的文件。

上传支持 JPEG、PNG、WebP，文件不超过 20 MB、解码后不超过 4000 万像素。浏览器生成至多 480/960/1600/2400 像素宽的 WebP，去除原图元信息；上传包上限 16 MB。上传的是网页版本，不保存摄影原图，原图请自行归档。失败时保留编辑内容并显示错误。

选择 R2 图片后，保存时自动写入封面或画廊的尺寸与 `srcset`。普通正文图片插入的是最大网页版本 URL。R2 免费额度有上限，本主题不承诺零费用。

公开图片 URL 持有者可以访问图片，即使对应文章尚未发布。图片键随机生成；媒体列表只供有写权限的后台用户访问。

## 配置与维护

- `cms.enabled: false` 不生成后台页面；博客仍能通过文件编辑维护。
- `features` 控制模块页面、导航、首页预览、后台入口与站点地图。
- 站点配置、作者和分类变动需重新构建。后台保存配置后，刷新已部署后台才能取得新字段选项。
- 切换图片存储不搬迁旧文件；既有本地 URL 与外部 URL 可以共存。
- 作者和分类 ID 应保持稳定；删除前先清理引用，分类父子关系不能成环。
- Decap 使用固定依赖版本，本地复制其资源；普通博客页面不加载 CMS。
- 本轮不部署 Worker、不创建 OAuth App、不读写远程仓库或 R2。相关网络链路的单元测试使用模拟服务，不能替代未来的真实凭据联调。
