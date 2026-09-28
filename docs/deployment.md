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

博客前台是纯静态部署，不需要 Astro Cloudflare adapter。`functions/` 目录由 Pages 自动部署为 Pages Functions，只处理 `/api/*`：GitHub 登录和可选的 R2 图片接口。`404.html` 用于 Pages 的缺失页面响应，不需要把所有请求重写到首页的 SPA fallback。

生产构建需要安装 devDependencies，因为后台资源是从固定版本的 Decap 分发包复制的。请关闭草稿分支的公开预览部署。

## 写作后台上线

1. **创建 GitHub OAuth App**（GitHub → Settings → Developer settings → OAuth Apps → New）：
   - Homepage URL：`https://你的域名`
   - Authorization callback URL：`https://你的域名/api/callback`
2. **在 Pages 项目中设置变量**（Settings → Variables and Secrets，生产环境）：
   - `GITHUB_REPO`：`owner/repo`，与 `site.config.json` 的 `cms.repo` 一致
   - `GITHUB_CLIENT_ID`：OAuth App 的 Client ID
   - `GITHUB_CLIENT_SECRET`：Client Secret，**选择 Secret 类型**，不要写进仓库
3. **仅 R2 模式**：创建 R2 bucket 并开启公开访问（自定义域名或 r2.dev），然后：
   - 在 Settings → Bindings 添加 R2 绑定，变量名 `MEDIA`
   - 设置变量 `PUBLIC_MEDIA_URL`，为 bucket 的公开地址，例如 `https://img.example.com`
   - 把 `site.config.json` 的 `media.provider` 改为 `r2`
4. 重新部署，打开 `https://你的域名/admin/`（或点页脚的“写作”），用 GitHub 登录。
5. 第二位作者：在 GitHub 仓库 Settings → Collaborators 邀请对方并授予写权限，再在后台“作者”中添加资料。

使用 `wrangler pages deploy` 而不是 Git 集成时，可以把 `wrangler.example.toml` 复制为 `wrangler.toml` 并填写；Secret 用 `wrangler pages secret put GITHUB_CLIENT_SECRET` 设置。文件一旦存在，Cloudflare 会以它为准，控制台里的同名配置会被覆盖。

## 上线验收

- 首页、分页、分类、标签、归档、文章、关于页与未知地址的 404。
- `/rss.xml`、`/sitemap-index.xml`、`/robots.txt` 中域名正确。
- `/search/?q=公式` 和英文查询均有真实结果。
- 图表主题切换、公式字体、文章图片没有 404。
- 草稿/未来文章无法访问，索引中没有演示的 `UnpublishedSentinelSecret`。
- `_headers` 生效；Pagefind 文件需及时重新验证，不能缓存为永不过期。
- 自定义域名由站点所有者在 Cloudflare 配置；若与初次部署域名不同，修改 siteURL 后重新构建，并同步更新 OAuth App 的回调地址。
- `/api/auth` 跳转到 GitHub；无写权限的账号登录后被拒绝。
- `/albums/`、`/photos/` 图片正常懒加载，查看器可以打开，`#photo-ID` 分享链接能直接定位到图片。

未来日期文章不会定时自行发布：在发布日期后触发新构建即可。该仓库的 GitHub Actions 只有验证，不会调用部署 API 或配置计划发布。

## 本地预览

`pnpm preview --host 127.0.0.1 --port 4321`。它预览构建产物，不是生产 Node 服务器；Cloudflare 直接分发 `dist/`。若修改正文后搜索结果未更新，重新运行 `pnpm build`，不要手工修改生成的索引文件。
