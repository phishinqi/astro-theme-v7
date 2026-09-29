import settings from '../../site.config.json';
import { siteConfig } from '../site.config';
import { licensePresets } from './licenses';
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
  { ...number('width'), label: '宽度（自动填写）' },
  { ...number('height'), label: '高度（自动填写）' },
  text('caption', '说明', false),
  text('color', '主色（自动填写）', false),
  text('srcset', '响应式图片集（R2 自动填写）', false),
];
// Multi-field lists keep each image as a plain object; v7-media-list fills in size and colour.
const imageList = {
  name: 'images',
  label: '图片',
  label_singular: '图片',
  widget: 'v7-media-list',
  required: false,
  summary: '{{fields.src}}',
  fields: imageFields,
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
const optional = <T extends object>(field: T) => ({ ...field, required: false });
const photoTagRelation = (name: string, label: string) => ({
  name,
  label,
  widget: 'relation',
  collection: 'data',
  file: 'photoTags',
  search_fields: ['tags.*.id'],
  value_field: 'tags.*.id',
  display_fields: ['tags.*.id'],
  multiple: true,
  required: false,
  hint: '在“作者、分类、标签与友链 → 照片标签”中维护可选标签。',
});
const licenseField = {
  name: 'license',
  label: '许可（留空沿用站点默认）',
  widget: 'select',
  options: [...licensePresets],
  required: false,
};
const photoFields = [
  { name: 'src', label: '图片', widget: 'image', hint: '上传时自动压缩为 WebP 并移除 EXIF。' },
  text('alt', '替代文本（描述画面，供读屏与加载失败时使用）'),
  { ...text('id', '图片 ID（用于分享链接；上传时自动生成）', false), pattern: slug.pattern },
  {
    name: 'kind',
    label: '类型',
    widget: 'select',
    options: [
      { label: '照片', value: 'photo' },
      { label: '创作', value: 'artwork' },
    ],
    default: 'photo',
  },
  text('title', '标题', false),
  optional({ name: 'caption', label: '说明', widget: 'text' }),
  optional({
    name: 'date',
    label: '拍摄 / 创作日期',
    widget: 'datetime',
    format: 'YYYY-MM-DD',
    date_format: 'YYYY-MM-DD',
    time_format: false,
    default: '',
  }),
  text('location', '地点', false),
  photoTagRelation('tags', '标签'),
  optional({ ...relation('author', 'authors', 'id'), label: '作者（留空沿用相册作者）' }),
  licenseField,
  text('licenseText', '自定义许可文字（许可选 custom 时填写）', false),
  {
    name: 'photo',
    label: '摄影参数（照片）',
    widget: 'object',
    collapsed: true,
    required: false,
    fields: [
      text('camera', '相机', false),
      text('lens', '镜头', false),
      text('focalLength', '焦距，如 35mm', false),
      text('aperture', '光圈，如 f/2.8', false),
      text('shutter', '快门，如 1/250s', false),
      optional({ ...number('iso'), label: 'ISO' }),
      text('film', '胶片型号', false),
      text('software', '后期软件', false),
    ],
  },
  {
    name: 'artwork',
    label: '创作信息（创作）',
    widget: 'object',
    collapsed: true,
    required: false,
    fields: [
      text('device', '设备，如 iPad Pro', false),
      text('software', '软件或工具，如 Procreate', false),
      text('medium', '媒介，如 数字、水彩', false),
    ],
  },
  { ...number('width'), label: '宽度（自动填写）' },
  { ...number('height'), label: '高度（自动填写）' },
  text('color', '主色（自动填写）', false),
  text('srcset', '响应式图片集（R2 自动填写）', false),
];
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
    if (name === 'license') return { ...licenseField, label: '相册图片默认许可', required: true };
    if (name === 'locale')
      return { name, label: '默认界面语言', widget: 'select', options: ['zh-CN', 'en'] };
    return { ...text(name, name, false), default: value };
  });
}
/** Settings the admin script needs that are not part of Decap's own configuration. */
export function adminSettings() {
  return {
    provider: siteConfig.media.provider,
    exifPrefill: siteConfig.media.exifPrefill,
    // public/admin/locale.js registers this language before the editor starts; Decap's own
    // zh_Hans file is older than the bundle, so registerLocale merges the missing keys in.
    locale: 'zh_Hans',
  };
}
export function cmsConfig() {
  return {
    locale: adminSettings().locale,
    backend: {
      name: 'github',
      repo: siteConfig.cms.repo,
      branch: siteConfig.cms.branch,
      // Empty authURL: the editor uses its own origin, where functions/api/ serves OAuth.
      base_url: siteConfig.cms.authURL.replace(/\/$/, ''),
      auth_endpoint: 'api/auth',
    },
    // DECAP_PROXY_PORT (build time) points the editor at a proxy started with the same PORT.
    local_backend:
      siteConfig.cms.localBackend && process.env.DECAP_PROXY_PORT
        ? { url: `http://localhost:${Number(process.env.DECAP_PROXY_PORT)}/api/v1` }
        : siteConfig.cms.localBackend,
    publish_mode: 'editorial_workflow',
    media_folder: 'public/images/uploads',
    public_folder: '/images/uploads',
    ...(siteConfig.media.provider === 'r2' ? { media_library: { name: 'v7-r2', config: {} } } : {}),
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
      ...(['moments', 'timeline', 'roadmap'] as const)
        .filter((name) => siteConfig.features[name])
        .map((name) => ({
          name,
          label: { moments: '动态', timeline: '时间线', roadmap: '路线图' }[name],
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
      ...(siteConfig.features.albums
        ? [
            {
              name: 'albums',
              label: '相册',
              folder: 'content/albums',
              create: true,
              extension: 'md',
              format: 'frontmatter',
              identifier_field: 'slug',
              slug: '{{slug}}',
              summary: '{{title}}',
              fields: [
                text('title', '标题'),
                slug,
                date('date'),
                bool('draft'),
                optional({ name: 'description', label: '简介', widget: 'text' }),
                optional({ ...relation('authors', 'authors', 'id', true), label: '作者' }),
                photoTagRelation('tags', '相册标签'),
                {
                  ...text('cover', '封面图片 ID（留空使用第一张）', false),
                  pattern: slug.pattern,
                },
                {
                  name: 'images',
                  label: '图片',
                  label_singular: '图片',
                  widget: 'v7-media-list',
                  v7_prefill: true,
                  required: false,
                  collapsed: true,
                  summary: '{{fields.title}} · {{fields.src}}',
                  fields: photoFields,
                },
                { ...body(), required: false },
              ],
            },
          ]
        : []),
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
          ...(siteConfig.features.albums
            ? [
                {
                  name: 'photoTags',
                  label: '照片标签',
                  file: 'data/photo-tags.json',
                  fields: [
                    {
                      name: 'tags',
                      label: '照片标签（与文章标签分开维护）',
                      widget: 'list',
                      fields: [
                        { ...text('id', '稳定 ID'), pattern: slug.pattern },
                        localized('label'),
                      ],
                    },
                  ],
                },
              ]
            : []),
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
