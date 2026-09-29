// Registers Decap's interface language and fills the gaps its own Chinese file still has in
// English. The vendor copy is an ES module, so it is loaded with a dynamic import rather than a
// classic <script> tag.
const LOCALE = 'zh_Hans';
// Phrases Decap 3.16 does not ship in zh_Hans yet (47 keys at the time of writing: note taking,
// list/object controls, media library and a few newer buttons). Same shape as decap-cms-locales.
const overrides = {
  auth: { loginWithForgejo: '使用 Forgejo 登录' },
  collection: {
    collectionTop: { viewAsList: '列表视图', viewAsGrid: '网格视图' },
    entries: { unpublishedHeader: '未发布的条目' },
  },
  editor: {
    editorControl: { field: { widgetLabel: '%{widgetLabel} 字段' } },
    editorControlPane: {
      widget: {
        rangeMin: '%{fieldLabel} 至少需要 %{minCount} 项。',
        rangeMax: '%{fieldLabel} 最多允许 %{maxCount} 项。',
      },
    },
    editorInterface: { toggleNotes: '显示或隐藏批注' },
    editorNotesPane: {
      title: '批注',
      emptyState: '还没有批注。在下面写下第一条，开始协作。',
      addNote: '添加批注',
      addPlaceholder: '写一条批注…',
      editPlaceholder: '修改这条批注…',
      save: '保存',
      cancel: '取消',
      edit: '编辑',
      delete: '删除',
      resolve: '标记为已解决',
      unresolve: '重新打开',
      confirmDelete: '确定要删除这条批注吗？',
      shortcut: '提示：按 Ctrl+Enter 可以快速添加批注',
    },
    editorToolbar: {
      statusInfoTooltipDraft: '条目状态是草稿。要定稿并提交审核，请把状态改为“审核中”。',
      statusInfoTooltipInReview: '条目正在审核，无需其他操作。审核期间你仍然可以继续修改。',
    },
    editorWidgets: {
      markdown: {
        strikethrough: '删除线',
        toggleMode: { rich: '切换到富文本模式', markdown: '切换到 Markdown 模式' },
      },
      image: {
        chooseMultiple: '选择图片',
        addMore: '继续添加图片',
        removeAll: '移除全部图片',
      },
      file: { chooseMultiple: '选择文件', addMore: '继续添加文件', removeAll: '移除全部文件' },
      datetime: { setToNow: '把 %{fieldLabel} 设为当前时间' },
      list: { addType: '添加%{item}' },
      object: { expand: '展开', collapse: '收起' },
    },
  },
  mediaLibrary: { mediaLibraryModal: { close: '关闭' } },
  ui: {
    settingsDropdown: { account: '账号菜单' },
    toast: {
      noteAdded: '批注已添加',
      onFailToAddNote: '添加批注失败：%{details}',
      noteUpdated: '批注已更新',
      onFailToUpdateNote: '更新批注失败：%{details}',
      noteDeleted: '批注已删除',
      onFailToDeleteNote: '删除批注失败：%{details}',
      noteResolved: '批注已标记为已解决',
      noteReopened: '批注已重新打开',
      onFailToToggleNote: '切换批注状态失败：%{details}',
    },
  },
};
const merge = (base, extra) => {
  const out = { ...base };
  for (const [key, value] of Object.entries(extra))
    out[key] =
      value && typeof value === 'object' && base?.[key] && typeof base[key] === 'object'
        ? merge(base[key], value)
        : value;
  return out;
};

export async function registerLocale(CMS) {
  try {
    const { default: phrases } = await import('./vendor/locales-zh_Hans.js');
    CMS.registerLocale(LOCALE, merge(phrases, overrides));
  } catch (error) {
    console.warn('Kept the default editor language:', error);
  }
}
