# 写作后台与图片

主题的写作后台是 [v7-cms](https://github.com/phishinqi/v7-cms)：一个开源的 Git 型编辑器，独立于本主题开发和发布。它读写 `content/` 里的文件，产出的字节和你手工编辑完全一致。

## 打开后台

```sh
pnpm install
pnpm dev:cms        # 启动站点；后台就在同一个进程里
```

打开 `http://localhost:4321/admin/`。线上从页脚右下角的「写作」链接进入。

不需要额外的本地服务。旧后台那套代理进程已经取消：v7-cms 在浏览器里直接读写你选的文件夹。

第一次打开会让你选一个仓库。**具体给哪些选项，取决于当前用的是哪份配置。**

### 两份配置，只差一行

后台的配置来自两个文件，它们的区别只有 `backend` 一项：

| 文件                     | backend                    | 什么时候用            |
| ------------------------ | -------------------------- | --------------------- |
| `cms.config.json`        | `local`（本机文件夹/代理） | `pnpm dev` 本地写作   |
| `cms.config.github.json` | `github`（仓库 API）       | `pnpm build` 线上部署 |

**不要手工维护第二份文件。** 它由 `scripts/cms-config-github.mjs` 从第一份生成，`pnpm build` 会自动跑一次：

```sh
pnpm cms:config     # 手动重新生成
```

生成脚本读三个可选环境变量，都有默认值：

| 变量            | 默认值                        |
| --------------- | ----------------------------- |
| `CMS_REPO`      | `phishinqi/astro-theme-v7`    |
| `CMS_BRANCH`    | `main`                        |
| `CMS_AUTH_BASE` | `https://v7.soyonagasaki.com` |

`src/pages/admin/[...path].astro` 按环境选：`astro dev` 用本地那份（直接编辑工作目录），生产构建用 GitHub 那份（部署出去的页面够不到你的硬盘，只能走 API）。

### 三种连接方式

| 方式       | 需要什么                     | 哪些浏览器能用                     |
| ---------- | ---------------------------- | ---------------------------------- |
| 本机文件夹 | 什么都不用                   | Chromium（File System Access API） |
| 本地代理   | `npx @v7-cms/proxy --root .` | 全部                               |
| GitHub     | 一个令牌，或走中转的 OAuth   | 全部                               |

**本机文件夹**最省事：选一次会被记住，编辑直接写进工作目录，`git status` 里立刻能看到改动。权限每次访问会重新申请，这是浏览器的要求。只有本地那份配置会给这个选项。

**GitHub** 是线上用的。部署后的 `/admin/` 只会给这一个入口。用个人访问令牌（fine-grained，只勾这一个仓库、只给 Contents 读写）可以立刻用；想让作者用 GitHub 账号登录，需要下面的 OAuth 配置。

### 线上登录：OAuth 配置

1. GitHub → Settings → Developer settings → OAuth Apps → New OAuth App：
   - Homepage URL：`https://v7.soyonagasaki.com`
   - Authorization callback URL：`https://v7.soyonagasaki.com/api/callback`
2. 在 Pages 项目里加环境变量（Settings → Variables and Secrets）：`GITHUB_REPO`、`GITHUB_CLIENT_ID`，以及 secret 类型（加密）的 `GITHUB_CLIENT_SECRET`。
3. 重新部署。

`/api/*` 由 `functions/api/[[path]].js` 提供，和站点同域名一起部署，不需要单独的 Worker。**没配这三项时 `/admin/` 仍能打开，只是登录会失败**——个人访问令牌那条路不依赖它们。

### 预览与内联编辑

编辑器右侧可以嵌入**真实页面**，并且直接在页面上点击编辑——鼠标划过标题会描边，点一下光标跳到对应的输入框。

预览源按环境自动选：

| 环境       | 预览源                  | 由谁决定                                    |
| ---------- | ----------------------- | ------------------------------------------- |
| `pnpm dev` | `http://localhost:4321` | `cms.config.json` 的 `preview.devServerURL` |
| 部署后     | 站点自己的域名          | 生成器写入，默认等于 `authBase`             |

**部署后预览的是已发布的站点。** 编辑器和站点同源，所以 iframe 能嵌入、桥接脚本能注入，内联编辑和本地一样可用。但要注意：**预览里是你已发布的内容，不是尚未提交的改动**——改完要提交并重新构建，预览才会变。

需要两件事配合，仓库里都已经配好：

1. **`X-Frame-Options: SAMEORIGIN`**（见 `public/_headers`）。原来是 `DENY`，站点连自己都不让嵌，预览 iframe 会被浏览器直接拒绝。改后第三方站点仍然嵌不了。
2. **字段标记在生产也输出**。`PostLayout` 给渲染每个字段的元素加 `data-v7-field="字段路径"`，部署后的编辑器要读的就是这份 HTML。这个属性本身不渲染、不影响样式、也不进 Pagefind 索引。

换预览源用环境变量：

```sh
CMS_SITE_URL=https://v7.soyonagasaki.com pnpm build   # 默认值就是它
CMS_DEV_SERVER_URL=https://dev.example.com pnpm build  # 改指一个远程 dev server
```

生成器**拒绝 `localhost` / `127.0.0.1`** 并直接报错。这个错误编译能过、部署能过，只在访问者的浏览器里炸，所以必须在这里拦住。

### 界面语言

后台界面跟随配置里的 `locale`。本仓库是 `zh-CN`，所以侧边栏、连接页、保存按钮和提示都是中文。改 `locale` 会同时影响本地和线上两份配置（生成脚本会带上）。

界面语言和**内容语言**是两件事：`locale` 只管编辑器自己的文案，文章的多语言字段仍按值里实际存在的语言逐个渲染。

## 正文：两套编辑器

这是换掉旧后台的主要原因之一。富文本编辑器会规范化 Markdown —— 重排强调符号、对齐表格、改围栏风格。这对随笔没问题，对 MDX 是灾难：MDX 里有 `import` 和 JSX，Markdown 编辑器根本不认识。

所以每段正文在打开前会先判定：

| 正文里有                                           | 用什么编辑器 |
| -------------------------------------------------- | ------------ |
| 随笔、标题、列表、链接、图片、普通代码块           | 富文本       |
| MDX 文件、`import`/`export`、JSX、HTML 块          | 源码         |
| 图表围栏（`mermaid`、`abc`）、块级公式、缩进代码块 | 源码         |

判定偏向保守：拿不准就走源码。误判成源码，你只是少了个好看的编辑器；误判成富文本，文件会被悄悄改坏。

实际表现：

- `content/posts/math-and-diagrams.md` 有 mermaid 围栏，走源码
- `content/posts/small-components.mdx` 是 MDX，走源码，`import` 和 `<Note>` 原样保留
- 普通的 `.md` 随笔走富文本，改完存回仍是 Markdown

编辑器旁边有预览：Markdown 预览始终可用，含图表和公式；配置里给了开发服务器地址时，还能用 iframe 嵌真实页面。

## 相册

相册在 `content/albums/`，后台按「相册」集合编辑。每张图可以记录类型（照片 / 创作）、标题、说明、日期、地点、标签、作者、许可，以及相机参数或创作设备。

**上传的图片会被重新编码成 WebP，EXIF、GPS 等全部元数据都会丢掉。** 这是有意为之：一张照片的拍摄地点不应该因为有人忘了而跟着发布出去。上传时先读 EXIF，把相机、镜头、焦距、光圈、快门、ISO、日期填进**空白**字段（你手填过的不会被覆盖），然后丢弃。上传后只保存网页版本，长边不超过 2400px；**原图请自行归档**。

## 站点设置

后台的「站点设置 → 全站配置」直接编辑 `site.config.json`：标题、简介、导航、社交链接、每页数量、模块开关、图片存储方式都能在这里改，不用手写 JSON。

表单是从文件本身推断出来的 —— 加了新配置项，后台自动多出对应字段，不需要改代码。保存后需要重新构建才会生效。

站点标题、简介、导航文字这类需要中英各一份的字段，后台拆成两个输入框（`zh-CN` 和 `en`）。语言列表来自文件本身，加一门语言不用改配置。

## 界面

界面语言由 v7-cms 自带（`locale`），不需要额外的语言包。外观沿用主题的纸白、陶土色与衬线标题，通过设计令牌配置，不依赖内部类名，升级不会失效。

## 草稿

有两个东西都叫「草稿」，别混：

- **文章头部的 `draft: true`** 是构建期排除标记，站点不会发布它。这是你自己的开关。
- **流程状态**是审核进度。用 GitHub 写作时存在独立分支；用本机文件夹时记在 `.v7-cms/workflow.json`（已加进 `.gitignore`）。

## 维护

- 后台资源是构建产物，由 `scripts/copy-cms.mjs` 从 v7-cms 的 release 复制到 `public/admin/`；该目录不提交。
- 升级编辑器：改 `scripts/copy-cms.mjs` 里的 `PINNED_VERSION` 为一个已发布的版本号。
- 改编辑器本身：`git clone` v7-cms，放到本主题同级的目录，脚本会优先使用本地构建。
- 后台的集合与字段定义在 `cms.config.json`。
- 内容校验仍由主题负责：`src/lib/post-schema.ts` 和 `src/lib/module-schema.ts` 在构建时检查，后台管不到的东西（分类是否存在、slug 是否重复）构建阶段会报错。
