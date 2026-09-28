# V7

以阅读为中心的 Astro 博客主题。暖纸白与陶土色、衬线正文、深色模式，以及独立于程序源码的内容目录。

[English](docs/README.en.md) · [写作后台与图片存储](docs/cms.md) · [部署说明](docs/deployment.md) · [验证记录](docs/validation.md)

## 开始

工具链：Node.js **24.16.0**，pnpm **12.5.1**。

```sh
pnpm install --frozen-lockfile
pnpm dev
# 另开终端，启用本地网页编辑
pnpm cms:local
```

浏览博客：`http://localhost:4321/`。写作后台：`http://localhost:4321/admin/`。本地代理直接修改工作目录；不要把代理端口暴露到公网。搜索需要先构建，再运行 `pnpm preview`。

## 内容目录

```text
content/posts/            # Markdown / MDX 文章，递归加载
  tech/astro content.md   # 支持多级目录、中文与空格
  journal/quiet afternoon.md
content/pages/            # about 等独立页面的正文
content/moments/ timeline/ roadmap/ albums/   # 其他模块内容
data/                     # 作者、分类、标签建议、友链
site.config.json          # 文件与后台共用的站点配置
src/                      # 模板、组件、样式、程序逻辑
worker/                   # 可选的 GitHub OAuth 与 R2 图片服务
```

**文件夹只负责整理。** 分类写在文章头部，公开地址由稳定 slug 决定，重命名或移动文件不会改变地址。MDX 组件通过 `@components/Note.astro` 等别名导入，不依赖目录深度。

## 写文章

```sh
pnpm new:post my-first-post tech "我的第一篇文章"
```

新文件默认是草稿。也可以直接创建文件或使用后台。

```yaml
---
title: 我的第一篇文章
description: 一段简短摘要
slug: my-first-post
pubDate: '2026-09-28T09:00:00+08:00'
category: astro
tags: [Astro, 写作]
authors: [v7, guest]
lang: zh-CN
draft: false
featured: false
---
```

- 一篇文章一个分类、多个标签及一位或多位作者。省略 authors 时使用默认作者。
- 分类支持父子关系，上级自动汇总后代文章。目录位置不影响分类。
- slug 必须唯一，包括草稿；发布后保持不变。正文页可复制永久链接。
- `draft: true` 和未来文章不会生成页面，也不进入 RSS、搜索和站点地图。定时内容到期后需重新构建。
- 日期写带时区的 ISO 字符串；纯日期按 UTC 零时处理。
- 普通 Markdown 可在源码与可视化模式间切换；复杂公式、Mermaid、HTML 和 MDX 使用源码模式。后台不执行自定义 MDX 代码。
- 代码高亮、复制、目录、KaTeX 和延迟加载 Mermaid 保留。文章内容必须是你信任的源码。

## 配置

编辑 `site.config.json` 或后台“站点设置”：标题、简介、默认界面语言、时区、导航、社交链接、每页数量和模块开关。修改后重新构建。

`data/authors.json` 管理作者资料；`data/categories.json` 管理稳定分类 ID 和 parent；`data/tags.json` 管理标签建议，文章标签仍可自由填写；`data/friends.json` 管理友链。删除作者或分类前清理文章引用。

顶部主要入口与“更多”菜单分开配置。演示默认开启全部模块；关闭 features 中的开关会移除模块页面、导航入口、首页预览及后台入口。全站保留普通文章、分类、标签、归档和作者页。

读者可以在同一个 URL 切换中英文界面，选择保存在本地。文章不翻译，关于页显示对应语言版本。搜索引擎和无 JavaScript 浏览器读取站点默认语言。更改默认语言时也要检查你自己的本地化配置文案。

## 图片与画廊

`media.provider` 支持 `github`（默认）和 `r2` 二选一。GitHub 模式把上传放进 `public/images/uploads/`；R2 模式使用配套受保护 Worker。具体限制与接入步骤见 [CMS 文档](docs/cms.md)。切换模式不会自动搬迁已有图片。

文章封面使用 `cover: { src, alt, width, height, focal?, caption?, srcset? }`；focal 为 0–100% 的两轴焦点，默认 `50% 50%`。封面支持列表缩略图与详情展示。未设置封面时维持文字布局。

MDX 可导入 `@components/Gallery.astro`，传入包含 src、alt、width、height 和可选 caption 的 images 数组。独立相册写在 `content/albums/`。图库支持点击放大、左右键和 Esc；关闭后焦点返回图片。

本地栅格封面和画廊在构建阶段生成响应式 WebP；R2 在上传时生成网页变体，不保存摄影原图。普通 Markdown 图片仍使用所写 URL，请避免直接引用超大原图。

## 功能页面

- `/friends/`：手动维护、分组展示的友链。
- `/moments/`：文字、图片和链接组成的短动态；首页显示最近三条。
- `/timeline/`：按时间记录已发生的里程碑。
- `/roadmap/`：planned、active、done 三种状态。
- `/albums/`：相册列表与相册详情。
- `/authors/{id}/`：作者介绍与文章分页。

新模块 Markdown 通用字段是 title、slug、date、draft；相册与动态可设置 images，路线图可设置 status。模块正文与文章同样排除草稿及未来条目。

统计仅计算公开内容，不采集访客行为。SEO 包括 canonical、分享元信息、多作者结构化数据、RSS、robots 与 sitemap。部署前必须把默认 `https://example.com` 换成你的根域名，主题不预设个人域名。

## 验证

```sh
pnpm exec playwright install chromium
pnpm verify
```

verify 执行类型、lint、格式、单元测试、生产构建和浏览器测试。单元测试覆盖发布规则、分类关系、作者、CMS 配置和 Worker 授权；浏览器测试覆盖搜索、交互、图片、语言、无障碍与链接。示例内容测试仍预期 12 篇公开文章，替换示例后需调整相应查询和断言。

主题切换采用柔和颜色过渡；页面切换采用原生文档 View Transitions，浏览器不支持时正常跳转。所有非必要动画遵守减少动态效果偏好。

## 许可与边界

主题代码和技术文档采用 [MIT](LICENSE)。文章、关于页和其他编辑内容不纳入代码许可，详见 [内容许可](CONTENT-LICENSE.md)。示例不陈述真实作者经历。

本轮没有创建远程仓库、部署网站、连接真实 GitHub OAuth 或上传 R2。外部服务接入需要使用者配置，并在上线前进行真实账号联调。
