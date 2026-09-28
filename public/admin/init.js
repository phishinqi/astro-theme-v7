import { prepareImage, uploadName, RASTER_TYPES } from './image-pipeline.js';
import { prefill, isImmutableMap } from './prefill.js';
const CMS = window.CMS;
const loading = document.getElementById('cms-loading');
const config = JSON.parse(document.getElementById('cms-config').textContent);
const settings = JSON.parse(document.getElementById('v7-admin').textContent);
// What the editor learnt while uploading (size, colour, EXIF, suggested id), keyed by public path.
const uploaded = new Map();
if (!CMS) {
  loading.textContent = '后台资源尚未准备好，请运行 pnpm dev 或 pnpm build。';
  throw new Error('Missing local Decap bundle');
}
// The local proxy is only enabled on loopback; published sites always use GitHub authentication.
config.local_backend =
  config.local_backend && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
// GitHub OAuth runs as a Pages Function on this same origin unless cms.authURL points elsewhere.
config.backend.base_url ||= location.origin;
const Rich = CMS.getWidget('richtext');
const SafeBody = window.createClass({
  render() {
    const value = this.props.value || '';
    const complex = /^\s*(import|export)\s|<[A-Za-z][^>]*>|```mermaid|\$[^$\n]+\$|\$\$/m.test(
      value,
    );
    return complex
      ? window.h(
          'div',
          {},
          window.h('p', {}, '复杂内容使用源码模式，保留公式、图表与组件。'),
          window.h('textarea', {
            id: this.props.forID,
            className: this.props.classNameWrapper,
            value,
            rows: 24,
            onChange: (event) => this.props.onChange(event.target.value),
            style: { width: '100%', fontFamily: 'monospace' },
          }),
        )
      : window.h(Rich.control, this.props);
  },
});
CMS.registerWidget('v7-body', SafeBody, Rich.preview);
const ObjectWidget = CMS.getWidget('object');
const empty = (value) => value === undefined || value === null || value === '';
const withAsset = (value, asset) => {
  for (const key of ['width', 'height', 'srcset', 'color'])
    if (!empty(asset[key])) value = value.set(key, asset[key]);
  return value;
};
function validImage() {
  const value = this.props.value?.toJS?.() || {};
  if (!Object.values(value).some((v) => !empty(v) && !(Array.isArray(v) && !v.length))) return true;
  if (
    !value.src ||
    !value.alt?.trim() ||
    !Number.isInteger(value.width) ||
    value.width < 1 ||
    !Number.isInteger(value.height) ||
    value.height < 1
  )
    return { error: '图片需要地址、替代文本和有效宽高。' };
  return true;
}
// Existing images picked without uploading still need their natural size.
function measure(widget, src) {
  const image = new Image();
  image.onload = () => {
    const current = widget.props.value;
    if (current?.get('src') === src)
      widget.props.onChange(
        current.merge({ width: image.naturalWidth, height: image.naturalHeight }),
      );
  };
  image.src = src;
}
// Decap's default object preview prints the field configuration; show the picture instead.
const ImagePreview = window.createClass({
  render() {
    const value = this.props.value;
    const src = value?.get?.('src');
    if (!src) return null;
    const asset = this.props.getAsset?.(src);
    return window.h(
      'figure',
      { style: { margin: '1em 0' } },
      window.h('img', {
        src: asset ? String(asset) : src,
        alt: value.get('alt') || '',
        style: { maxWidth: '100%' },
      }),
      window.h('figcaption', {}, value.get('title') || value.get('caption') || ''),
    );
  },
});
const MediaObject = window.createClass({
  isValid: validImage,
  changed(value) {
    const src = value?.get('src');
    const asset = uploaded.get(src);
    if (asset) value = withAsset(value, asset);
    const changed = src && src !== this.props.value?.get('src');
    this.props.onChange(value);
    if (changed && !asset) measure(this, src);
  },
  render() {
    return window.h(ObjectWidget.control, { ...this.props, onChange: this.changed });
  },
});
CMS.registerWidget('v7-image', MediaObject, ImagePreview);

const PREFILL_KEY = 'v7-exif-prefill';
const prefillWanted = () => {
  try {
    return localStorage.getItem(PREFILL_KEY) !== 'off';
  } catch {
    return true;
  }
};
// Image lists (album photos, moment images). Decap only passes list items through to an
// `object` widget, so the upload bookkeeping lives here, on the whole list: any item whose image
// is new gets its size, colour and (when enabled) EXIF-derived blanks filled in.
const ListWidget = CMS.getWidget('list');
const MediaList = window.createClass({
  getInitialState() {
    return { prefill: prefillWanted() };
  },
  canPrefill() {
    return settings.exifPrefill && this.props.field.get('v7_prefill') === true;
  },
  toggle(event) {
    const on = event.target.checked;
    try {
      localStorage.setItem(PREFILL_KEY, on ? 'on' : 'off');
    } catch {
      /* The choice still applies until the page reloads. */
    }
    this.setState({ prefill: on });
  },
  changed(list, metadata) {
    const known = new Set((this.props.value?.toArray?.() || []).map((item) => item?.get?.('src')));
    const unmeasured = [];
    const next = list.map((item) => {
      const src = isImmutableMap(item) ? item.get('src') : undefined;
      if (!src || known.has(src)) return item;
      const asset = uploaded.get(src);
      if (!asset) {
        unmeasured.push(src);
        return item;
      }
      item = withAsset(item, asset);
      return this.canPrefill() && this.state.prefill ? prefill(item, asset) : item;
    });
    this.props.onChange(next, metadata);
    for (const src of unmeasured) {
      const image = new Image();
      image.onload = () => {
        const current = this.props.value;
        const index = current?.findIndex?.((item) => item?.get?.('src') === src);
        if (index === undefined || index < 0) return;
        this.props.onChange(
          current.update(index, (item) =>
            item.merge({ width: image.naturalWidth, height: image.naturalHeight }),
          ),
        );
      };
      image.src = src;
    }
  },
  render() {
    return window.h(
      'div',
      {},
      this.canPrefill() &&
        window.h(
          'label',
          {
            style: {
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              margin: '12px 0',
              fontSize: '14px',
            },
          },
          window.h('input', {
            type: 'checkbox',
            checked: this.state.prefill,
            onChange: this.toggle,
          }),
          '上传后从 EXIF 自动填入空白字段（相机、镜头、参数、日期）',
        ),
      window.h(ListWidget.control, { ...this.props, onChange: this.changed }),
    );
  },
});
CMS.registerWidget('v7-media-list', MediaList, ListWidget.preview);

const notice = (() => {
  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.style.cssText =
    'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:100000;padding:10px 16px;border-radius:6px;background:#29251f;color:#f8f5ef;font:14px system-ui;display:none';
  document.body.append(el);
  let timer;
  return (text, sticky = true) => {
    clearTimeout(timer);
    el.textContent = text || '';
    el.style.display = text ? 'block' : 'none';
    if (text && !sticky) timer = setTimeout(() => (el.style.display = 'none'), 6000);
  };
})();

// Repository uploads use Decap's own media library, so drafts, branches and commits behave as
// usual. Its file input is intercepted before React sees the change event, and the chosen files
// are swapped for compressed WebP copies with no EXIF, GPS or other metadata left in them.
if (settings.provider === 'github') {
  const replayed = new WeakSet();
  window.addEventListener(
    'change',
    (event) => {
      const input = event.target;
      if (
        !(input instanceof HTMLInputElement) ||
        input.type !== 'file' ||
        input.dataset.v7Upload !== undefined ||
        replayed.has(event) ||
        !Array.from(input.files || []).some((file) => file.type.startsWith('image/'))
      )
        return;
      event.stopImmediatePropagation();
      const files = Array.from(input.files);
      void (async () => {
        try {
          notice('正在压缩图片并移除 EXIF…');
          const output = [];
          for (const file of files) {
            if (RASTER_TYPES.includes(file.type)) {
              const id = uploadName(file.name);
              const { exif, color, variants } = await prepareImage(file, { longEdge: 2400 });
              const [image] = variants;
              output.push(new File([image.blob], `${id}.webp`, { type: 'image/webp' }));
              uploaded.set(`${config.public_folder}/${id}.webp`, {
                id,
                width: image.width,
                height: image.height,
                color,
                exif,
              });
            } else if (['image/svg+xml', 'image/gif'].includes(file.type)) output.push(file);
            else if (file.type.startsWith('image/'))
              throw new Error(`${file.name}：请先转换为 JPEG、PNG 或 WebP。`);
            else output.push(file);
          }
          const transfer = new DataTransfer();
          output.forEach((file) => transfer.items.add(file));
          input.files = transfer.files;
          const replay = new Event('change', { bubbles: true });
          replayed.add(replay);
          input.dispatchEvent(replay);
          notice('');
        } catch (error) {
          input.value = '';
          notice(error.message, false);
        }
      })();
    },
    true,
  );
}

const token = () => {
  try {
    return JSON.parse(localStorage.getItem('netlify-cms-user') || '{}').token || '';
  } catch {
    return '';
  }
};
const element = (tag, text) => {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  return el;
};
CMS.registerMediaLibrary({
  name: 'v7-r2',
  init({ handleInsert }) {
    const dialog = element('dialog');
    dialog.style.cssText =
      'width:min(90vw,800px);max-height:85vh;padding:24px;border:1px solid #aaa;background:white;color:#222;z-index:9999';
    const title = element('h2', 'R2 图片库');
    const status = element('p');
    status.setAttribute('role', 'status');
    const close = element('button', '关闭');
    close.type = 'button';
    close.onclick = () => dialog.close();
    const input = element('input');
    input.type = 'file';
    input.accept = RASTER_TYPES.join(',');
    input.dataset.v7Upload = '';
    input.setAttribute('aria-label', '上传图片');
    const grid = element('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px';
    const more = element('button', '加载更多');
    more.type = 'button';
    let cursor = '';
    const insert = (asset, extra = {}) => {
      uploaded.set(asset.src, { ...asset, ...extra });
      handleInsert(asset.src);
      dialog.close();
    };
    const request = async (path, init = {}) => {
      const authorization = token();
      if (!authorization) throw new Error('R2 需要 GitHub 登录；本地代理模式不提供 GitHub 令牌。');
      const response = await fetch('/api' + path, {
        ...init,
        headers: { ...init.headers, Authorization: `Bearer ${authorization}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '图片服务请求失败');
      return data;
    };
    const list = async (append = false) => {
      try {
        status.textContent = '正在读取图片…';
        const data = await request(
          '/media' + (append && cursor ? '?cursor=' + encodeURIComponent(cursor) : ''),
        );
        if (!append) grid.replaceChildren();
        for (const asset of data.assets) {
          const button = element('button');
          button.type = 'button';
          const img = element('img');
          img.src = asset.src;
          img.alt = asset.name || '';
          img.style.cssText = 'width:100%;height:120px;object-fit:cover';
          button.append(img, element('span', asset.name));
          button.onclick = () => insert(asset);
          grid.append(button);
        }
        cursor = data.cursor || '';
        more.hidden = !cursor;
        status.textContent = '选择图片插入；图片说明和替代文本在表单中填写。';
      } catch (error) {
        status.textContent = error.message;
      }
    };
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      input.disabled = true;
      try {
        status.textContent = '正在生成响应式图片并移除 EXIF…';
        const { exif, color, variants } = await prepareImage(file, {
          widths: [480, 960, 1600, 2400],
        });
        const form = new FormData();
        const sizes = variants.map(({ width, height, blob }) => {
          const field = `file-${width}`;
          form.append(field, blob, field + '.webp');
          return { field, width, height };
        });
        form.append('metadata', JSON.stringify({ name: file.name, color, sizes }));
        status.textContent = '正在上传…';
        const asset = await request('/media', { method: 'POST', body: form });
        insert(asset, { id: uploadName(file.name), exif });
      } catch (error) {
        status.textContent = error.message;
      } finally {
        input.disabled = false;
        input.value = '';
      }
    };
    more.onclick = () => void list(true);
    dialog.append(title, close, input, status, grid, more);
    document.body.append(dialog);
    return {
      show() {
        dialog.showModal();
        void list();
      },
      hide() {
        dialog.close();
      },
      enableStandalone() {
        return true;
      },
    };
  },
});
// Optional blanks would otherwise be saved as '' and fail the build's date and enum checks.
const prune = (value) =>
  value
    .map((v) => (isImmutableMap(v) ? prune(v) : v))
    .filter((v) => !empty(v) && !(isImmutableMap(v) && v.size === 0));
CMS.registerEventListener({
  name: 'preSave',
  handler: ({ entry }) => {
    let data = entry.get('data');
    const apply = (value) => {
      const asset = uploaded.get(value?.get('src'));
      return prune(asset ? withAsset(value, asset) : value);
    };
    if (data.get('cover') && isImmutableMap(data.get('cover')))
      data = data.getIn(['cover', 'src']) ? data.update('cover', apply) : data.delete('cover');
    for (const key of ['updatedDate', 'ogImage', 'description', 'cover'])
      if (data.has(key) && empty(data.get(key))) data = data.delete(key);
    if (data.get('images')) data = data.update('images', (images) => images.map(apply));
    return data;
  },
});
CMS.registerEventListener({
  name: 'prePublish',
  handler: ({ entry }) => {
    if (entry.getIn(['data', 'draft']))
      throw new Error(
        '请先关闭文章的 draft 标记并保存，再发布。编辑流程中的未发布草稿仍保存在独立分支。',
      );
  },
});
loading.remove();
CMS.init({ config, load_config_file: false });
