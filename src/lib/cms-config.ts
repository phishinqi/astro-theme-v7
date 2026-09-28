import settings from '../../site.config.json';
import { siteConfig } from '../site.config';
const text = (name: string, label = name, required = true) => ({
  name,
  label,
  widget: 'string',
  required,
});
const localized = (name: string) => ({
  name,
  label: name,
  widget: 'object',
  fields: [text('zh-CN', '中文'), text('en', 'English')],
});
const slug = {
  ...text('slug', '永久链接 slug'),
  pattern: ['^[a-z0-9]+(?:-[a-z0-9]+)*$', '使用小写英文、数字和连字符；发布后保持不变。'],
};
const bool = (name: string, value = false) => ({
  name,
  label: name,
  widget: 'boolean',
  default: value,
  required: false,
});
const date = (name: string) => ({
  name,
  label: name,
  widget: 'datetime',
  format: 'YYYY-MM-DDTHH:mm:ssZ',
  date_format: 'YYYY-MM-DD',
  time_format: 'HH:mm',
});
const number = (name: string) => ({
  name,
  label: name,
  widget: 'number',
  value_type: 'int',
  min: 1,
});
const imageFields = [
  { name: 'src', label: '图片 / Image', widget: 'image' },
  text('alt', '替代文本'),
  number('width'),
  number('height'),
  text('caption', '说明', false),
  text('srcset', '响应式图片集（R2 上传后可填）', false),
];
const imageList = {
  name: 'images',
  label: '图片',
  widget: 'list',
  required: false,
  field: {
    name: 'image',
    label: '图片',
    widget: 'v7-image',
    fields: imageFields.map((field) => ({ ...field, required: false })),
  },
};
const body = (raw = false) => ({
  name: 'body',
  label: raw ? '正文源码（MDX 保真）' : '正文',
  widget: raw ? 'text' : 'v7-body',
  ...(raw ? {} : { modes: ['raw', 'rich_text'] }),
});
const relation = (name: string, file: string, field: string, multiple = false) => ({
  name,
  label: name,
  widget: 'relation',
  collection: 'data',
  file,
  search_fields: [`${file}.*.${field}`],
  value_field: `${file}.*.${field}`,
  display_fields: [`${file}.*.${field}`],
  multiple,
});
const postFields = [
  text('title', '标题'),
  { ...text('description', '摘要'), widget: 'text' },
  slug,
  date('pubDate'),
  { ...date('updatedDate'), required: false },
  relation('category', 'categories', 'id'),
  {
    name: 'tags',
    label: '标签',
    widget: 'list',
    required: false,
    field: text('tag'),
    hint: '使用统一拼写；可在数据管理中维护标签建议。',
  },
  { ...relation('authors', 'authors', 'id', true), default: [siteConfig.defaultAuthor] },
  { name: 'lang', label: '正文语言', widget: 'select', options: ['zh-CN', 'en'], default: 'zh-CN' },
  bool('draft'),
  bool('featured'),
  {
    name: 'cover',
    label: '封面',
    widget: 'v7-image',
    required: false,
    fields: [
      ...imageFields.map((field) => ({ ...field, required: false })),
      { ...text('focal', '裁切焦点', false), hint: '例如 50% 50%；留空使用中心。' },
    ],
  },
  { name: 'ogImage', label: '分享图', widget: 'image', required: false },
];
function settingsFields(value: Record<string, unknown>): unknown[] {
  return Object.entries(value).map(([name, value]): unknown => {
    if (Array.isArray(value))
      return {
        name,
        label: name,
        widget: 'list',
        fields:
          name === 'nav' || name === 'moreNav'
            ? [text('href'), localized('label')]
            : name === 'socialLinks'
              ? [text('label'), text('href')]
              : value[0]
                ? settingsFields(value[0])
                : [],
        required: false,
      };
    if (value && typeof value === 'object')
      return {
        name,
        label: name,
        widget: 'object',
        fields: settingsFields(value as Record<string, unknown>),
      };
    if (typeof value === 'boolean') return bool(name, value);
    if (typeof value === 'number') return { ...number(name), min: name === 'postsPerPage' ? 1 : 0 };
    if (name === 'provider')
      return { name, label: '图片存储', widget: 'select', options: ['github', 'r2'] };
    if (name === 'locale')
      return { name, label: '默认界面语言', widget: 'select', options: ['zh-CN', 'en'] };
    return { ...text(name, name, false), default: value };
  });
}
export function cmsConfig() {
  return {
    backend: {
      name: 'github',
      repo: siteConfig.cms.repo,
      branch: siteConfig.cms.branch,
      ...(siteConfig.cms.authURL
        ? { base_url: siteConfig.cms.authURL, auth_endpoint: 'auth' }
        : {}),
    },
    local_backend: siteConfig.cms.localBackend,
    publish_mode: 'editorial_workflow',
    media_folder: 'public/images/uploads',
    public_folder: '/images/uploads',
    ...(siteConfig.media.provider === 'r2'
      ? { media_library: { name: 'v7-r2', config: { workerURL: siteConfig.media.workerURL } } }
      : {}),
    collections: [
      ...(['md', 'mdx'] as const).map((extension) => ({
        name: `posts-${extension}`,
        label: extension === 'md' ? '文章 · Markdown' : '文章 · MDX 源码',
        folder: 'content/posts',
        create: true,
        summary: '{{title}}',
        extension,
        format: 'frontmatter',
        slug: '{{slug}}',
        identifier_field: 'slug',
        nested: { depth: 50, subfolders: false },
        meta: { path: { widget: 'string', label: '文件位置（不决定分类）' } },
        fields: [...postFields, body(extension === 'mdx')],
      })),
      {
        name: 'pages',
        label: '独立页面',
        files: ['zh', 'en'].map((lang) => ({
          name: `about-${lang}`,
          label: `关于 · ${lang}`,
          file: `content/pages/about.${lang}.mdx`,
          fields: [body(true)],
        })),
      },
      ...(['moments', 'timeline', 'roadmap', 'albums'] as const)
        .filter((name) => siteConfig.features[name])
        .map((name) => ({
          name,
          label: { moments: '动态', timeline: '时间线', roadmap: '路线图', albums: '相册' }[name],
          folder: `content/${name}`,
          create: true,
          extension: 'md',
          format: 'frontmatter',
          identifier_field: 'slug',
          slug: '{{slug}}',
          fields: [
            text('title'),
            slug,
            date('date'),
            bool('draft'),
            ...(name === 'roadmap'
              ? [
                  {
                    name: 'status',
                    label: '状态',
                    widget: 'select',
                    options: ['planned', 'active', 'done'],
                  },
                ]
              : []),
            imageList,
            body(),
          ],
        })),
      {
        name: 'data',
        label: '作者、分类、标签与友链',
        files: [
          {
            name: 'authors',
            label: '作者',
            file: 'data/authors.json',
            fields: [
              {
                name: 'authors',
                label: '作者列表',
                widget: 'list',
                fields: [
                  text('id', '稳定 ID'),
                  text('name', '姓名'),
                  localized('bio'),
                  { name: 'avatar', label: '头像', widget: 'image', required: false },
                  {
                    name: 'links',
                    label: '社交链接',
                    widget: 'list',
                    required: false,
                    fields: [text('label'), text('href')],
                  },
                ],
              },
            ],
          },
          {
            name: 'categories',
            label: '多级分类',
            file: 'data/categories.json',
            fields: [
              {
                name: 'categories',
                label: '分类列表',
                widget: 'list',
                fields: [
                  text('id', '稳定 ID'),
                  localized('title'),
                  localized('description'),
                  text('parent', '父分类 ID（顶层留空）', false),
                ],
              },
            ],
          },
          {
            name: 'tags',
            label: '标签建议',
            file: 'data/tags.json',
            fields: [{ name: 'tags', label: '标签', widget: 'list', fields: [text('name')] }],
          },
          ...(siteConfig.features.friends
            ? [
                {
                  name: 'friends',
                  label: '友链',
                  file: 'data/friends.json',
                  fields: [
                    {
                      name: 'friends',
                      label: '友链列表',
                      widget: 'list',
                      fields: [
                        text('name'),
                        text('url'),
                        text('description'),
                        { name: 'avatar', label: '头像', widget: 'image', required: false },
                        text('group'),
                      ],
                    },
                  ],
                },
              ]
            : []),
        ],
      },
      {
        name: 'settings',
        label: '站点设置',
        files: [
          {
            name: 'site',
            label: '全站配置',
            file: 'site.config.json',
            fields: settingsFields(settings),
          },
        ],
      },
    ],
  };
}
