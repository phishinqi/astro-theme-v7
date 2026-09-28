# Cloudflare Pages 静态部署

## 部署前

1. 使用 Node.js 24.16.0 / pnpm 12.5.1 干净安装：`pnpm install --frozen-lockfile`。
2. 修改 `site.config.json` 的真实域名、作者、简介、社交链接。不要让 `example.com` 进入正式 canonical、RSS、站点地图和分享信息。
3. 替换示例文章、关于页及默认分享图；确认日期时区、草稿状态。
4. 运行 `pnpm verify`，检查浅深色、移动端与无 JavaScript 下的文章阅读。
5. 由站点所有者创建远程仓库，提交源码与锁文件。不提交 `node_modules/`、`.astro/` 或 `dist/`。

## Pages 配置

通过 Cloudflare 控制台连接仓库，选择 Astro 或手动设置：

- Build command：`pnpm build`
- Build output directory：`dist`
- Root directory：仓库根目录
- Production branch：由站点所有者选择
- 环境变量：`NODE_VERSION=24.16.0`、`PNPM_VERSION=12.5.1`

`package.json` 的 packageManager 与 `.node-version` 也声明了工具链版本。在构建日志确认实际版本，不要只依赖平台默认值。若所选构建镜像不能提供指定 pnpm，可在平台配置中关闭自动依赖安装（`SKIP_DEPENDENCY_INSTALL=1`），用以下显式构建命令：

```sh
npm install --global pnpm@12.5.1 && pnpm install --frozen-lockfile && pnpm build
```

博客前台是纯静态部署，不需要 Astro Cloudflare adapter。可选写作后台另外使用 `worker/` 提供 GitHub OAuth；R2 模式复用该 Worker 提供图片接口，详见 [CMS 接入](cms.md)。`404.html` 用于 Pages 的缺失页面响应。无需添加将所有请求重写到首页的 SPA fallback。

生产构建需安装 devDependencies，因为后台资源从固定版本 Decap 分发包复制。关闭草稿分支的公开预览部署。

## 上线验收

- 首页、分页、分类、标签、归档、文章、关于页与未知地址的 404。
- `/rss.xml`、`/sitemap-index.xml`、`/robots.txt` 中域名正确。
- `/search/?q=公式` 和英文查询均有真实结果。
- 图表主题切换、公式字体、文章图片没有 404。
- 草稿/未来文章无法访问，索引中没有演示的 `UnpublishedSentinelSecret`。
- `_headers` 生效；Pagefind 文件需及时重新验证，不能缓存为永不过期。
- 自定义域名由站点所有者在 Cloudflare 配置；若与初次部署域名不同，修改 siteURL 后重新构建。

未来日期文章不会定时自行发布：在发布日期后触发新构建即可。该仓库的 GitHub Actions 只有验证，不会调用部署 API 或配置计划发布。

## 本地预览

`pnpm preview --host 127.0.0.1 --port 4321`。它预览构建产物，不是生产 Node 服务器；Cloudflare 直接分发 `dist/`。若修改正文后搜索结果未更新，重新运行 `pnpm build`，不要手工修改生成的索引文件。
