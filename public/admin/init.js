const CMS = window.CMS;
const loading = document.getElementById('cms-loading');
const config = JSON.parse(document.getElementById('cms-config').textContent);
const uploaded = new Map();
if (!CMS) {
  loading.textContent = '后台资源尚未准备好，请运行 pnpm dev 或 pnpm build。';
  throw new Error('Missing local Decap bundle');
}
// The local proxy is only enabled on loopback; published sites always use GitHub authentication.
config.local_backend =
  config.local_backend && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
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
const MediaObject = window.createClass({
  isValid() {
    const value = this.props.value?.toJS?.() || {};
    if (!Object.values(value).some((v) => v !== null && v !== undefined && v !== '')) return true;
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
  },
  changed(value) {
    const src = value?.get('src');
    const asset = uploaded.get(src);
    if (asset)
      value = value.merge({ width: asset.width, height: asset.height, srcset: asset.srcset });
    const changed = src && src !== this.props.value?.get('src');
    this.props.onChange(value);
    if (changed && !asset) {
      const image = new Image();
      image.onload = () => {
        const current = this.props.value;
        if (current?.get('src') === src)
          this.props.onChange(
            current.merge({ width: image.naturalWidth, height: image.naturalHeight }),
          );
      };
      image.src = src;
    }
  },
  render() {
    return window.h(ObjectWidget.control, { ...this.props, onChange: this.changed });
  },
});
CMS.registerWidget('v7-image', MediaObject, ObjectWidget.preview);
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
  init({ options, handleInsert }) {
    const worker = options.config.workerURL?.replace(/\/$/, '');
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
    input.accept = 'image/jpeg,image/png,image/webp';
    input.setAttribute('aria-label', '上传图片');
    const grid = element('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px';
    const more = element('button', '加载更多');
    more.type = 'button';
    let cursor = '';
    const insert = (asset) => {
      uploaded.set(asset.src, asset);
      handleInsert(asset.src);
      dialog.close();
    };
    const request = async (path, init = {}) => {
      if (!worker) throw new Error('请先填写 media.workerURL。');
      const authorization = token();
      if (!authorization) throw new Error('R2 需要 GitHub 登录；本地代理模式不提供 GitHub 令牌。');
      const response = await fetch(worker + path, {
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
        status.textContent = '选择图片插入；图片说明和替代文本在文章中填写。';
      } catch (error) {
        status.textContent = error.message;
      }
    };
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      input.disabled = true;
      let bitmap;
      try {
        if (file.size > 20 * 1024 * 1024)
          throw new Error('请上传 20 MB 以下的 JPEG、PNG 或 WebP。');
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
          throw new Error('仅支持 JPEG、PNG、WebP。');
        status.textContent = '正在生成响应式图片…';
        bitmap = await createImageBitmap(file);
        if (bitmap.width * bitmap.height > 40_000_000)
          throw new Error('图片超过 4000 万像素，请先缩小。');
        const widths = [...new Set([480, 960, 1600, 2400].map((w) => Math.min(w, bitmap.width)))];
        const form = new FormData();
        const sizes = [];
        for (const width of widths) {
          const height = Math.round((bitmap.height * width) / bitmap.width);
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
          const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.84));
          if (!blob || blob.type !== 'image/webp') throw new Error('当前浏览器不支持 WebP 编码。');
          const field = `file-${width}`;
          form.append(field, blob, field + '.webp');
          sizes.push({ field, width, height });
        }
        form.append('metadata', JSON.stringify({ name: file.name, sizes }));
        status.textContent = '正在上传…';
        const asset = await request('/media', { method: 'POST', body: form });
        insert(asset);
      } catch (error) {
        status.textContent = error.message;
      } finally {
        bitmap?.close();
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
CMS.registerEventListener({
  name: 'preSave',
  handler: ({ entry }) => {
    let data = entry.get('data');
    const apply = (value) => {
      const asset = uploaded.get(value?.get('src'));
      return asset
        ? value.merge({ width: asset.width, height: asset.height, srcset: asset.srcset })
        : value;
    };
    if (data.get('cover'))
      data = data.getIn(['cover', 'src']) ? data.update('cover', apply) : data.delete('cover');
    for (const key of ['updatedDate', 'ogImage'])
      if (data.has(key) && !data.get(key)) data = data.delete(key);
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
