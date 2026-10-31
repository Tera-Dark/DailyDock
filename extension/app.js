const TASKS_KEY = "dailydock.tasks";
const SETTINGS_KEY = "dailydock.settings";
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const popup = document.body.classList.contains("popup");
const extensionMode = Boolean(globalThis.chrome?.runtime?.id && chrome.storage?.local);
const storage = extensionMode ? chrome.storage.local : {
  async get(keys) {
    const result = {};
    for (const key of (Array.isArray(keys) ? keys : [keys])) {
      const value = localStorage.getItem(key);
      if (value !== null) {
        try { result[key] = JSON.parse(value); }
        catch (error) { if (key !== SETTINGS_KEY) throw error; }
      }
    }
    return result;
  },
  async set(values) {
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, JSON.stringify(value));
  }
};
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
const pad = n => String(n).padStart(2, "0");
const dayKey = (d = new Date()) => [d.getFullYear(), pad(d.getMonth() + 1), pad(d.getDate())].join("-");
const uid = () => globalThis.crypto?.randomUUID?.() || `task-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const safeUrl = raw => {
  if (!raw) return "";
  try {
    const url = new URL(String(raw));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
};
const symbols = {
  check: '<path d="m5 12 4 4L19 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  external: '<path d="M14 3h7v7M10 14 21 3"/><path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  settings: '<path d="M12 3v3M12 18v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M3 12h3M18 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/><circle cx="12" cy="12" r="4"/>',
  arrow: '<path d="m9 18 6-6-6-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  edit: '<path d="M12 20h9"/><path d="M16 4a2.1 2.1 0 0 1 3 3L9 17l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6M10 11v6M14 11v6"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4"/>',
  moon: '<path d="M20 15.5A8 8 0 0 1 8.5 4 8 8 0 1 0 20 15.5Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
  panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  grip: '<circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/>',
  repeat: '<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>'
};
function icon(name, size = 18) {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (symbols[name] || symbols.check) + '</svg>';
}
let tasks = [];
let settings = { theme: "system" };
let section = "sites";
let siteCategory = "";
let filter = "all";
let search = "";
let toastTimer = null;
const starterSites = [
  { title: "Linux DO", url: "https://linux.do/", category: "社区" },
  { title: "昆仑 API", url: "https://api.kunyou.asia/dashboard", category: "API 服务" },
  { title: "AnyRouter", url: "https://anyrouter.top/console", category: "API 服务" },
  { title: "X666", url: "https://x666.me/", category: "社区" }
];
const dateLabel = () => new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date());
function isDue(task, date = new Date()) {
  if (task.repeat === "daily") return true;
  if (task.repeat === "weekly") return Array.isArray(task.weekdays) && task.weekdays.includes(date.getDay());
  return !task.date || task.date <= dayKey(date);
}
function isDone(task, date = new Date()) {
  return (task.completed || []).includes(task.repeat === "once" ? "__once__" : dayKey(date));
}
function sorting(a, b) {
  return Number(isDone(a)) - Number(isDone(b))
    || (a.time || "99:99").localeCompare(b.time || "99:99")
    || (a.createdAt || 0) - (b.createdAt || 0);
}
function activeTasks() { return tasks.filter(t => !t.deletedAt); }
function currentTasks() {
  let list = section === "all" ? activeTasks() : section === "sites" ? activeTasks().filter(x => x.url) : activeTasks().filter(x => isDue(x));
  list = list.filter(task => filter === "all" || (filter === "done" ? isDone(task) : !isDone(task)));
  const term = search.trim().toLocaleLowerCase();
  if (term) list = list.filter(t => [t.title, t.category, t.url].some(v => String(v || "").toLocaleLowerCase().includes(term)));
  return [...list].sort(sorting);
}
function applyTheme() {
  const dark = settings.theme === "dark" || (settings.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}
function logo() { return '<div class="brand"><span class="brand-mark">' + icon("check") + '</span><span>DailyDock</span></div>'; }
function taskMeta(task) {
  const repeat = task.repeat === "daily" ? "每天" : task.repeat === "weekly" ? (task.weekdays || []).map(x => weekdays[x]).join("、") || "每周" : task.date || "单次";
  return [task.category || (task.url ? "网页签到" : "待办"), repeat, task.time, task.remind ? "提醒已开" : ""].filter(Boolean).join(" · ");
}
function taskRow(task) {
  const checked = isDone(task);
  return '<div class="task-row' + (checked ? ' done' : '') + '">' +
    '<label class="check-wrap"><input type="checkbox" data-toggle="' + escapeHtml(task.id) +
    '" aria-label="' + (checked ? '取消完成：' : '标记完成：') + escapeHtml(task.title) + '"' + (checked ? ' checked' : '') + '></label>' +
    '<div class="task-content"><div class="task-title">' + escapeHtml(task.title) +
    '</div><div class="task-meta">' + escapeHtml(taskMeta(task)) + '</div></div>' +
    '<div class="task-actions">' +
    (task.url ? '<button type="button" class="open-btn" data-open="' + escapeHtml(task.id) + '" aria-label="打开网站：' + escapeHtml(task.title) + '" title="在新标签页打开签到网站">' + (popup ? '打开' : '') + icon("external", 15) + '</button>' : '') +
    (!popup ? '<button type="button" class="icon-btn" data-edit="' + escapeHtml(task.id) + '" aria-label="编辑：' + escapeHtml(task.title) + '" title="编辑">' + icon("edit", 16) + '</button>' +
      '<button type="button" class="icon-btn critical" data-delete="' + escapeHtml(task.id) + '" aria-label="删除：' + escapeHtml(task.title) + '" title="删除">' + icon("trash", 16) + '</button>' : '') +
    '</div></div>';
}
function listMarkup(list, emptyTitle, emptyHelp) {
  return list.length ? '<div class="list">' + list.map(taskRow).join("") + '</div>' :
    '<div class="empty"><div class="empty-title">' + escapeHtml(emptyTitle) + '</div><div class="tiny">' + escapeHtml(emptyHelp) + '</div></div>';
}
function progressMarkup() {
  const due = activeTasks().filter(t => isDue(t));
  const completed = due.filter(task => isDone(task)).length;
  const percent = due.length ? Math.round(completed * 100 / due.length) : 0;
  return { due, completed, percent };
}
function quickForm() {
  return '<form id="quick-form" class="quick-form" autocomplete="off"><label class="quick-label" for="quick-title">快速添加每日任务</label>' +
    '<input id="quick-title" type="text" maxlength="160" placeholder="添加一项每日任务…" required>' +
    '<button type="submit" class="btn primary" aria-label="添加每日任务" title="添加每日任务">' + icon("plus", 18) + (popup ? '' : '添加') + '</button></form>';
}
function renderPopup() {
  const stat = progressMarkup();
  const shown = [...stat.due].sort(sorting);
  return '<main class="popup-shell">' +
    '<header class="popup-header">' + logo() + '<button type="button" class="icon-btn" data-manage title="打开管理页面" aria-label="打开管理页面">' + icon("settings", 18) + '</button></header>' +
    '<div class="popup-summary"><div><div class="eyebrow">今天 · ' + escapeHtml(dateLabel()) + '</div><h1>' + (stat.due.length ? (stat.due.length === stat.completed ? '今日已完成' : '还有 ' + (stat.due.length - stat.completed) + ' 件待办') : '开始新的一天') + '</h1></div>' +
    '<span class="count">' + stat.completed + ' / ' + stat.due.length + ' 已完成</span></div>' +
    '<div class="progress" role="progressbar" aria-valuenow="' + stat.percent + '" aria-valuemin="0" aria-valuemax="100" aria-label="今日完成进度"><div class="progress-fill" style="width:' + stat.percent + '%"></div></div>' +
    quickForm() + '<div class="section-header"><h2>今日清单</h2><span class="muted tiny">' + (stat.due.length ? '完成后自动记录' : '一切从第一件小事开始') + '</span></div>' +
    listMarkup(shown, '今天还没有任务', '在上方输入内容，回车即可添加每日任务。') +
    '<footer class="popup-footer"><span class="muted tiny">仅保存在当前浏览器</span><button type="button" class="text-link" data-manage>查看全部与设置 ' + '→</button></footer></main>';
}
function navItem(id, text, name, count) {
  return '<button type="button" class="nav-button' + (section === id ? ' active' : '') + '" data-nav="' + id + '" aria-label="' + text + '" title="' + text + '"' + (section === id ? ' aria-current="page"' : '') + '>' +
    icon(name, 18) + '<span>' + text + '</span>' + (count != null ? '<span class="nav-count">' + count + '</span>' : '') + '</button>';
}
function viewName() { return ({ today: "今天", all: "全部任务", sites: "网站签到", notes: "便利贴", trash: "回收站", settings: "偏好与数据" })[section]; }
function renderOptions() {
  const stat = progressMarkup();
  const title = viewName();
  const help = ({ today: "专注今天真正需要完成的事情。", all: "所有单次、周期与未来任务集中管理。", sites: "你的每日签到入口，都在这里。", notes: "写下、摆放，留给自己一块小小的空间。", trash: "放进回收站的内容可以恢复。", settings: "外观、数据备份与本地隐私设置。" })[section];
  return '<div class="options-shell' + (settings.sidebarCollapsed ? ' sidebar-collapsed' : '') + '"><aside class="sidebar"><div class="sidebar-top">' + logo() + '<button type="button" class="sidebar-toggle icon-btn" data-sidebar aria-label="' + (settings.sidebarCollapsed ? '展开侧边栏' : '收起侧边栏') + '" title="' + (settings.sidebarCollapsed ? '展开侧边栏' : '收起侧边栏') + '">' + icon('panel', 18) + '</button></div>' +
    '<nav class="nav" aria-label="主要导航">' +
    navItem("today", "今天", "calendar", stat.due.filter(t => !isDone(t)).length) +
    navItem("all", "全部任务", "list", activeTasks().length) +
    navItem("sites", "网站签到", "link", activeTasks().filter(t => t.url).length) +
    navItem("notes", "便利贴", "edit", activeTasks().filter(t => !t.url).length) +
    navItem("trash", "回收站", "trash", tasks.filter(t => t.deletedAt).length) +
    navItem("settings", "偏好与数据", "settings") + '</nav>' +
    '<div class="side-bottom"><div class="tiny muted">安静地记住每一件小事。</div><p>本地存储 · 无账户 · 无云端</p></div></aside>' +
    '<main class="workspace"><div class="workspace-inner">' +
    '<header class="page-top"><div class="page-heading">' + (section === 'today' ? '<div class="eyebrow">' + escapeHtml(dateLabel()) + '</div>' : '') + '<h1>' + title + '</h1><p>' + help + '</p></div>' +
    (["settings", "trash", "notes"].includes(section) ? '' : '<div class="page-actions"><button class="btn ' + (section === 'today' ? '' : 'primary') + '" data-add>' + icon("plus", 16) + (section === 'sites' ? ' 添加网站' : ' 新建任务') + '</button></div>') + '</header>' +
    (section === "settings" ? settingsMarkup() : section === "sites" ? sitesMarkup() : section === "notes" ? quickNoteMarkup() + notesMarkup() : section === "trash" ? trashMarkup() : listViewMarkup(stat)) +
    '</div></main></div>' +
    taskDialogMarkup() + '<input type="file" id="import-file" class="import-input" accept="application/json,.json">';
}
function listViewMarkup(stat) {
  let intro = '';
  if (section === "today") {
    intro = '<div class="overview"><div><div class="number">' + stat.completed + ' / ' + stat.due.length + '</div><div class="muted tiny">今日事项已完成</div></div>' +
      '<div class="progress" role="progressbar" aria-valuenow="' + stat.percent + '" aria-valuemin="0" aria-valuemax="100" aria-label="今日完成进度"><div class="progress-fill" style="width:' + stat.percent + '%"></div></div></div>' + quickForm();
  }
  const shown = currentTasks();
  const noData = activeTasks().length === 0;
  const emptyTitle = noData ? "还没有任务" : search ? "没有找到匹配的任务" : filter === "done" ? "尚无已完成事项" : filter === "pending" ? "暂时没有待完成事项" : "这里没有任务";
  const emptyHelp = noData ? "点击「新建任务」开始使用 DailyDock。" : search ? "试着更换搜索关键词。" : section === "sites" ? "在任务编辑中添加一个网站地址。" : "可以调整筛选条件，或新建一个任务。";
  return intro + '<div class="search-bar"><div class="search-wrap">' + icon("search", 16) +
    '<label class="sr-only" for="task-search">搜索任务</label><input id="task-search" type="text" placeholder="搜索任务、类别或网址" value="' + escapeHtml(search) + '"></div>' + (search ? '<button class="btn subtle" type="button" data-clear-search>清除</button>' : '') +
    '<span class="tiny muted">' + shown.length + ' 项</span></div>' +
    '<div class="filters" role="group" aria-label="任务状态筛选">' +
    [["all", "全部"], ["pending", "待完成"], ["done", "已完成"]].map(([value,label]) =>
      '<button type="button" class="filter' + (filter === value ? ' active' : '') + '" data-filter="' + value + '" aria-pressed="' + (filter === value) + '">' + label + '</button>').join("") + '</div>' +
    listMarkup(shown, emptyTitle, emptyHelp) +
    '<div class="note">网页签到不会自动完成；点击「打开」后，请在网站签到并回来勾选。' + (extensionMode ? '提醒需保持浏览器运行。' : '网页版提醒需保持页面打开。') + '</div>';
}
function siteHostname(task) {
  try { return new URL(task.url).hostname.replace(/^www\./, ""); } catch { return ""; }
}
function siteIcon(task) {
  const host = siteHostname(task);
  const known = { "linux.do": ["L", "linux"], "api.kunyou.asia": ["K", "kunyou"], "anyrouter.top": ["A", "anyrouter"], "x666.me": ["X", "x666"] };
  const [letter, color] = known[host] || [(task.title || host || "?").trim().charAt(0).toUpperCase(), "other"];
  const image = host === "x666.me" ? '<img src="' + (extensionMode ? 'icons/x666.ico' : 'extension/icons/x666.ico') + '" alt="" loading="lazy">' : '';
  return '<span class="site-icon site-icon--' + color + '" aria-hidden="true"><span>' + escapeHtml(letter) + '</span>' + image + '</span>';
}
function siteCard(task) {
  const done = isDone(task);
  return '<article class="site-card"><button type="button" class="site-launch" data-open="' + escapeHtml(task.id) + '" aria-label="打开网站：' + escapeHtml(task.title) + '">' +
    siteIcon(task) + '<span class="site-name">' + escapeHtml(task.title) + '</span><span class="site-host">' + escapeHtml(siteHostname(task)) + '</span>' + (task.remind && task.time ? '<span class="reminder-tag">' + icon("bell", 13) + ' ' + escapeHtml(task.time) + '</span>' : '') + '</button>' +
    '<div class="site-bottom"><label class="site-check"><input type="checkbox" data-toggle="' + escapeHtml(task.id) + '" aria-label="' + (done ? '取消完成：' : '标记完成：') + escapeHtml(task.title) + '"' + (done ? ' checked' : '') + '><span>' + (done ? '已签到' : '待签到') + '</span></label>' +
    '<button type="button" class="site-edit" data-edit="' + escapeHtml(task.id) + '" aria-label="编辑：' + escapeHtml(task.title) + '" title="编辑">' + icon("edit", 15) + '</button><button type="button" class="site-edit critical" data-delete="' + escapeHtml(task.id) + '" aria-label="删除：' + escapeHtml(task.title) + '" title="删除">' + icon("trash", 15) + '</button></div></article>';
}
function sitesMarkup() {
  const all = activeTasks().filter(t => t.url);
  const categories = [...new Set(all.map(t => t.category?.trim() || "未分类"))].sort((a,b) => a.localeCompare(b, "zh-CN"));
  const term = search.trim().toLocaleLowerCase();
  const shown = all.filter(t => (siteCategory === "" || (t.category?.trim() || "未分类") === siteCategory) &&
    (!term || [t.title, t.category, t.url].some(value => String(value || "").toLocaleLowerCase().includes(term)))).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const done = all.filter(t => isDue(t) && isDone(t)).length;
  const due = all.filter(t => isDue(t)).length;
  return '<div class="desk-intro"><div><span class="desk-kicker">A LITTLE SPACE FOR TODAY</span><h2>把今天的小事，放在这里。</h2><p>常去的网站和随手记，都有自己的位置。</p></div><div class="desk-count"><span>今日签到</span><strong>' + done + ' <small>/ ' + due + '</small></strong></div></div>' + quickNoteMarkup() + '<div class="desk-section-heading"><div><span class="desk-index">01 / YOUR LINKS</span><h2>常去的网站</h2></div><span class="desk-caption">打开后，记得回来打个勾</span></div>' +
    '<div class="sites-toolbar"><div class="search-wrap">' + icon("search", 16) + '<label class="sr-only" for="task-search">搜索网站</label><input id="task-search" type="text" placeholder="搜索网站名称、分类或网址" value="' + escapeHtml(search) + '"></div>' +
    (search ? '<button class="btn subtle" type="button" data-clear-search>清除</button>' : '') + '<span class="site-result">' + shown.length + ' 个网站</span></div>' +
    '<div class="category-bar" role="group" aria-label="网站分类">' + [["", "全部"], ...categories.map(c => [c,c])].map(([value,label]) => '<button type="button" class="category-chip' + (siteCategory === value ? ' active' : '') + '" data-category="' + escapeHtml(value) + '" aria-pressed="' + (siteCategory === value) + '">' + escapeHtml(label) + '</button>').join("") + '</div>' +
    (shown.length ? '<div class="site-grid">' + shown.map(siteCard).join("") + '</div>' : '<div class="empty site-empty"><div class="empty-title">' + (all.length ? '没有找到网站' : '还没有签到网站') + '</div><div class="tiny">' + (all.length ? '试试其他关键词或分类。' : '点击右上角添加网站，将常用入口放在这里。') + '</div></div>') +
    '<p class="sites-hint">网站图标使用本地资源或名称首字母。签到状态由你手动记录。</p>' + notesMarkup();
}
function quickNoteMarkup() {
  return '<form id="note-form" class="note-composer"><div class="note-pin" aria-hidden="true"></div><div class="note-compose-body">' +
    '<label for="note-input">随手贴一张</label><span>一件小事，或一个网址</span>' +
    '<input id="note-input" maxlength="2048" autocomplete="off" placeholder="例如：喝水 / Linux DO https://linux.do" required>' +
    '<div class="note-compose-bottom"><span>网址自动生成网站卡片 · 文字生成单次待办</span><button type="submit" class="btn note-submit">贴上 ' + icon("arrow", 16) + '</button></div></div></form>';
}
function noteSorting(a, b) {
  return (Number.isFinite(a.noteOrder) ? a.noteOrder : a.createdAt || 0) - (Number.isFinite(b.noteOrder) ? b.noteOrder : b.createdAt || 0) || (a.createdAt || 0) - (b.createdAt || 0);
}
function notesMarkup() {
  const notes = activeTasks().filter(t => !t.url).sort(noteSorting);
  return '<section class="notes-section"><div class="desk-section-heading"><div><span class="desk-index">LITTLE NOTES</span><h2>便利贴 <span class="note-count">' + notes.length + '</span></h2></div><div class="note-tools"><span class="desk-caption">按住图钉拖动 · 也可以用箭头移动</span><button type="button" class="btn" data-tidy' + (notes.length < 2 ? ' disabled' : '') + '>一键整理</button></div></div>' +
    (notes.length ? '<div class="notes-grid">' + notes.map((t, index) => '<article class="paper-note' + (isDone(t) ? ' is-done' : '') + '" data-note="' + escapeHtml(t.id) + '"><div class="note-top"><button type="button" class="drag-handle" data-drag="' + escapeHtml(t.id) + '" aria-label="按住图钉拖动排序：' + escapeHtml(t.title) + '" title="按住图钉拖动调整顺序"><span class="pin-head" aria-hidden="true"></span></button><span class="note-order">' + String(index + 1).padStart(2, "0") + '</span></div><p>' + escapeHtml(t.title) + '</p>' + (!isDue(t) ? '<span class="note-date">' + escapeHtml(taskMeta(t)) + '</span>' : '') + (t.remind && t.time ? '<span class="reminder-tag">' + icon("bell", 13) + ' ' + escapeHtml(t.time) + ' 提醒</span>' : '') + '<div class="paper-note-bottom"><label><input type="checkbox" data-toggle="' + escapeHtml(t.id) + '" aria-label="' + (isDone(t) ? '取消完成：' : '标记完成：') + escapeHtml(t.title) + '"' + (isDone(t) ? ' checked' : '') + '> ' + (isDone(t) ? '完成了' : '待完成') + '</label><button type="button" class="site-edit" data-move="' + escapeHtml(t.id) + '" data-direction="-1" aria-label="前移：' + escapeHtml(t.title) + '" title="前移"' + (index === 0 ? ' disabled' : '') + '>←</button><button type="button" class="site-edit" data-move="' + escapeHtml(t.id) + '" data-direction="1" aria-label="后移：' + escapeHtml(t.title) + '" title="后移"' + (index === notes.length - 1 ? ' disabled' : '') + '>→</button><button type="button" class="site-edit" data-edit="' + escapeHtml(t.id) + '" aria-label="编辑：' + escapeHtml(t.title) + '">' + icon("edit", 15) + '</button><button type="button" class="site-edit critical" data-delete="' + escapeHtml(t.id) + '" aria-label="移到回收站：' + escapeHtml(t.title) + '">' + icon("trash", 15) + '</button></div></article>').join("") + '</div>' : '<div class="notes-empty">还没有便利贴，在上面写一条试试。</div>') + '</section>';
}
function trashMarkup() {
  const items = tasks.filter(t => t.deletedAt).sort((a, b) => b.deletedAt - a.deletedAt);
  return '<div class="trash-intro"><p>这里的内容会一直保留，直到你手动永久删除。</p></div>' + (items.length ? '<div class="trash-list">' + items.map(t => '<div class="trash-row"><div class="trash-copy"><strong>' + escapeHtml(t.title) + '</strong><span>' + (t.url ? '网站' : '便利贴 / 待办') + ' · 移除于 ' + escapeHtml(new Date(t.deletedAt).toLocaleDateString("zh-CN")) + '</span></div><button class="btn" data-restore="' + escapeHtml(t.id) + '">恢复</button><button class="btn danger" data-purge="' + escapeHtml(t.id) + '">永久删除</button></div>').join("") + '</div>' : '<div class="notes-empty">回收站是空的。</div>');
}
async function reorderNotes(id, targetId, tidy = false, direction = 0) {
  const saved = await persist(latest => {
    const notes = latest.filter(t => !t.deletedAt && !t.url).sort(noteSorting);
    if (tidy) notes.sort((a, b) => Number(isDone(a)) - Number(isDone(b)) || (a.createdAt || 0) - (b.createdAt || 0));
    else {
      const from = notes.findIndex(t => t.id === id);
      const to = direction ? from + direction : notes.findIndex(t => t.id === targetId);
      if (from < 0 || to < 0 || to >= notes.length || from === to) return null;
      const [moved] = notes.splice(from, 1);
      notes.splice(to, 0, moved);
    }
    const ranks = new Map(notes.map((t, index) => [t.id, index]));
    return latest.map(t => ranks.has(t.id) ? { ...t, noteOrder: ranks.get(t.id) } : t);
  }, tidy ? "已按未完成、已完成整理" : "位置已保存");
  if (saved && id) $(`[data-drag="${CSS.escape(id)}"]`)?.focus();
  if (saved && tidy) $("[data-tidy]")?.focus();
}
function parseQuickNote(raw) {
  const text = raw.trim();
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s]+/i);
  const bare = !match && /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#]\S*)?$/i.test(text) ? text : "";
  if (!match && !bare && /\b[a-z][a-z0-9+.-]*:\/\//i.test(text)) throw new Error("网址只支持 http 或 https。");
  const url = match ? safeUrl(match[0]) : bare ? safeUrl("https://" + bare) : "";
  if ((match || bare) && !url) throw new Error("网址格式不正确，请检查后再试。");
  const title = url ? (match ? text.replace(match[0], "").trim() : "") || new URL(url).hostname.replace(/^www\./, "") : text;
  if (title.length > 160) throw new Error("内容不能超过 160 个字。");
  return { title, url };
}
async function addNote(raw) {
  let parsed;
  try { parsed = parseQuickNote(raw); } catch (error) { notify(error.message); return false; }
  if (!parsed) return false;
  let duplicate = false;
  const task = { id: uid(), ...parsed, category: parsed.url && siteCategory && siteCategory !== "未分类" ? siteCategory : "", repeat: parsed.url ? "daily" : "once", weekdays: [], date: "", time: "", remind: false, completed: [], createdAt: Date.now() };
  const saved = await persist(latest => {
    if (parsed.url && latest.some(t => !t.deletedAt && safeUrl(t.url) === parsed.url)) { duplicate = true; return null; }
    return [...latest, task];
  }, parsed.url ? "网站已贴好" : "随手记已贴好");
  if (duplicate) notify("这个网址已经在清单里了。");
  if (saved) { search = ""; siteCategory = ""; render(); $("#note-input")?.focus(); }
  return saved;
}
const REMINDER_LOG_KEY = "dailydock.reminderLog";
let audioContext = null;
let testTimer = null;
function notificationState() {
  if (extensionMode) return "扩展通知已启用；还需检查系统通知设置。";
  if (!("Notification" in globalThis)) return "当前浏览器不支持桌面通知；仍可在页面内看到提醒。";
  return ({ granted: "桌面通知已允许。", denied: "桌面通知已被阻止，请在浏览器的网站设置中允许。", default: "桌面通知尚未授权。" })[Notification.permission] || "无法读取通知权限。";
}
function reminderSettingsMarkup() {
  return '<section class="reminder-settings"><span class="desk-index">REMINDERS</span><h2>提醒与测试</h2>' +
    '<p class="muted">' + (extensionMode ? '扩展提醒使用系统通知及其通知音；测试音在当前页面播放。' : '保持这个网页打开，时间到了会提示；桌面通知需授权。关闭网页或浏览器后不会提醒。') + '</p>' +
    '<div class="reminder-status"><span class="reminder-status-dot" aria-hidden="true"></span><span id="notification-state">' + escapeHtml(notificationState()) + '</span></div>' +
    '<div class="settings-tools">' + (!extensionMode && "Notification" in globalThis && Notification.permission !== "granted" ? '<button type="button" class="btn" data-notification-permission>开启桌面通知</button>' : '') +
    '<button type="button" class="btn" data-test-sound>试听提醒音</button><button type="button" class="btn primary" data-test-reminder>10 秒后测试提醒</button></div>' +
    '<p id="reminder-test-status" class="reminder-test-status" role="status" aria-live="polite">测试不会创建任务。请检查设备音量；浏览器或系统可能阻止声音与通知。</p></section>';
}
async function unlockAudio() {
  try {
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Audio) return false;
    audioContext ||= new Audio();
    if (audioContext.state === "suspended") await audioContext.resume();
    return audioContext.state === "running";
  } catch { return false; }
}
function playReminderSound() {
  if (!audioContext || audioContext.state !== "running") return false;
  try {
    const now = audioContext.currentTime;
    [0, .19, .4].forEach((offset, index) => {
      const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = [660, 830, 990][index];
      gain.gain.setValueAtTime(.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(.14, now + offset + .025);
      gain.gain.exponentialRampToValueAtTime(.0001, now + offset + .28);
      oscillator.connect(gain); gain.connect(audioContext.destination);
      oscillator.start(now + offset); oscillator.stop(now + offset + .3);
    });
    return true;
  } catch { return false; }
}
async function showReminder(title, test = false) {
  const sound = playReminderSound();
  let desktop = false;
  try {
    if (extensionMode) {
      await chrome.notifications.create("test:" + Date.now(), { type: "basic", iconUrl: chrome.runtime.getURL("icon.png"), title: "DailyDock · 提醒测试", message: title });
      desktop = true;
    } else if ("Notification" in globalThis && Notification.permission === "granted") {
      new Notification(test ? "DailyDock · 提醒测试" : "DailyDock · 到点提醒", { body: title, silent: sound, icon: "extension/icon.png" });
      desktop = true;
    }
  } catch (error) { console.error("DailyDock notification failed", error); }
  notify((test ? "测试提醒：" : "到点提醒：") + title);
  return { sound, desktop };
}
function dueAtMinute(task, date) {
  return !task.deletedAt && task.remind && isDue(task, date) && !isDone(task, date) && task.time === pad(date.getHours()) + ":" + pad(date.getMinutes());
}
let checkingReminders = false;
async function checkWebReminders() {
  if (extensionMode || checkingReminders) return;
  checkingReminders = true;
  try {
    const check = async () => {
      const now = new Date(), today = dayKey(now);
      const data = await storage.get([TASKS_KEY, REMINDER_LOG_KEY]);
      const current = Array.isArray(data[TASKS_KEY]) ? data[TASKS_KEY] : [];
      const old = data[REMINDER_LOG_KEY];
      const log = old && old.day === today && Array.isArray(old.keys) ? old.keys : [];
      const due = current.filter(t => dueAtMinute(t, now) && !log.includes(t.id + "|" + t.time));
      if (!due.length) return;
      await storage.set({ [REMINDER_LOG_KEY]: { day: today, keys: [...log, ...due.map(t => t.id + "|" + t.time)] } });
      for (const task of due) await showReminder(task.title);
    };
    if (globalThis.navigator?.locks) await navigator.locks.request("dailydock.reminders", check);
    else await check();
  } catch (error) { console.error("DailyDock reminder check failed", error); }
  finally { checkingReminders = false; }
}
function settingsMarkup() {
  return '<section><h2 style="font-size:16px;font-weight:650;margin-bottom:6px">外观</h2>' +
    '<p class="muted tiny">按照系统自动选择主题，或指定浅色与深色。</p>' +
    '<div class="settings-tools">' +
    [["system", "跟随系统"], ["light", "浅色"], ["dark", "深色"]].map(([val,label]) =>
      '<button class="btn ' + (settings.theme === val ? 'primary' : '') + '" data-theme="' + val + '" aria-pressed="' + (settings.theme === val) + '">' +
      icon(val === "dark" ? "moon" : "sun", 16) + label + '</button>').join("") + '</div></section>' +
    '<div class="divider" style="margin:26px 0"></div>' + reminderSettingsMarkup() + '<div class="divider" style="margin:26px 0"></div><section><h2 style="font-size:16px;font-weight:650;margin-bottom:6px">本地数据</h2>' +
    '<p class="muted tiny">数据保存在当前浏览器的' + (extensionMode ? '扩展存储' : '网站存储') + '中。清理数据可能造成丢失，建议定期导出备份。</p>' +
    '<div class="settings-tools"><button class="btn" data-export>' + icon("download", 16) + ' 导出 JSON</button>' +
    '<button class="btn" data-import>' + icon("upload", 16) + ' 导入 JSON</button></div>' +
    '<p class="note">导入将覆盖当前全部任务，操作前请先备份。DailyDock 不会上传任务或保存网站的登录凭证。</p></section>';
}
function taskDialogMarkup() {
  return '<dialog id="task-dialog" class="task-dialog" aria-labelledby="dialog-title" aria-describedby="dialog-description">' +
    '<div class="dialog-top"><div><span class="dialog-kicker">A LITTLE NOTE</span><h2 id="dialog-title">新建任务</h2><p id="dialog-description">把需要记住的写下来，其他细节可以慢慢补。</p></div><button type="button" class="icon-btn dialog-close" data-close aria-label="关闭编辑窗口">' + icon("close", 18) + '</button></div>' +
    '<form id="task-form" novalidate><div class="editor-body">' +
    '<label class="field title-field"><span id="editor-title-label">写下这件事</span><input type="text" name="title" required maxlength="160" placeholder="例如：今天记得喝水" autocomplete="off"></label>' +
    '<div class="editor-rule"><div class="editor-section-title"><span class="editor-icon">' + icon("repeat", 16) + '</span><div><strong>什么时候做？</strong><small>设定这张便签的出现频率</small></div></div>' +
    '<div class="form-grid editor-rule-grid"><label class="field"><span>重复频率</span><select name="repeat"><option value="daily">每天</option><option value="weekly">指定星期</option><option value="once">单次任务</option></select></label>' +
    '<label class="field hidden" id="date-wrap"><span>任务日期（可选）</span><input type="date" name="date"><span class="help">不填就从今天开始。</span></label>' +
    '<fieldset class="field wide hidden weekday-field" id="weekdays-wrap"><legend>重复日期</legend><div class="weekdays">' +
    [1,2,3,4,5,6,0].map(x => '<label class="day-label"><input type="checkbox" name="weekday" value="' + x + '">' + weekdays[x] + '</label>').join("") + '</div></fieldset></div></div>' +
    '<div class="reminder-block"><label class="reminder-switch"><span class="editor-icon">' + icon("bell", 16) + '</span><span class="reminder-copy"><strong>到点提醒我</strong><small>' + (extensionMode ? '浏览器运行时使用系统通知' : '页面打开时提醒') + '</small></span><input name="remind" type="checkbox"></label>' +
    '<div class="reminder-fields hidden" id="reminder-fields"><label class="field"><span>提醒时间</span><input type="time" name="time"></label><p class="help">' + (extensionMode ? '需要系统允许浏览器通知。' : '保持页面打开，并在偏好与数据中允许通知。') + '</p></div></div>' +
    '<details class="editor-details" id="editor-details"><summary><span>更多细节</span><small>分类、网站地址</small><span class="details-chevron" aria-hidden="true">⌄</span></summary>' +
    '<div class="editor-extra"><label class="field"><span>分类（可选）</span><input type="text" name="category" maxlength="40" placeholder="例如：学习、生活"></label>' +
    '<label class="field"><span>网站地址（可选）</span><input name="url" type="url" placeholder="https://example.com"><span class="help">打开网站后，需要回来手动标记完成。</span></label></div></details>' +
    '<div class="field-error hidden" id="form-error" role="alert"></div></div>' +
    '<div class="dialog-bottom"><span class="dialog-bottom-hint">保存在本地</span><button type="button" class="btn" data-close>取消</button><button type="submit" class="btn primary">保存任务</button></div></form></dialog>';
}
function ensureToast() {
  let node = $("#status-toast");
  if (!node) { node = document.createElement("div"); node.id = "status-toast"; node.className = "status-toast"; node.role = "status"; node.setAttribute("aria-live", "polite"); node.hidden = true; document.body.append(node); }
  return node;
}
function notify(message) {
  const el = ensureToast();
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2700);
}
async function persist(change, message) {
  try {
    const save = async () => {
      const data = await storage.get(TASKS_KEY);
      const latest = Array.isArray(data[TASKS_KEY]) ? data[TASKS_KEY] : [];
      const next = typeof change === "function" ? change(latest) : change;
      if (!next) return false;
      await storage.set({ [TASKS_KEY]: next });
      tasks = next;
      return true;
    };
    const saved = globalThis.navigator?.locks ? await navigator.locks.request("dailydock.tasks", save) : await save();
    if (!saved) { if ($("#task-dialog")?.open) formError("任务已在其他页面修改或删除，请关闭窗口后重新打开。"); else notify("任务已在其他页面修改，请重新打开后再试。"); return false; }
    render();
    if (message) notify(message);
    return true;
  } catch (err) {
    console.error("DailyDock save failed:", err);
    if (!$("#task-dialog")?.open) render();
    if ($("#task-dialog")?.open) formError("保存失败，请检查浏览器存储空间后重试。");
    else notify("保存失败，请检查浏览器存储空间。");
    return false;
  }
}
async function toggle(id) {
  await persist(latest => latest.map(t => {
    if (t.id !== id) return t;
    const key = t.repeat === "once" ? "__once__" : dayKey();
    const completed = isDone(t) ? (t.completed || []).filter(x => x !== key) : [...new Set([...(t.completed || []), key])];
    return { ...t, completed };
  }));
  $(`[data-toggle="${CSS.escape(id)}"]`)?.focus();
}
async function addQuick(title) {
  const cleaned = title.trim();
  if (!cleaned) return;
  if (cleaned.length > 160) return notify("任务名称太长。");
  const task = {
    id: uid(), title: cleaned, category: "", repeat: "daily", weekdays: [],
    date: "", time: "", url: "", remind: false, completed: [], createdAt: Date.now()
  };
  if (await persist(latest => [...latest, task], "已添加每日任务")) $("#quick-title")?.focus();
}
let editingId = null;
let editingSnapshot = null;
function toggleFormFields() {
  const form = $("#task-form");
  if (!form) return;
  const type = form.elements.namedItem("repeat").value;
  $("#weekdays-wrap")?.classList.toggle("hidden", type !== "weekly");
  $("#date-wrap")?.classList.toggle("hidden", type !== "once");
  const remind = form.elements.namedItem("remind").checked;
  $("#reminder-fields")?.classList.toggle("hidden", !remind && !form.elements.namedItem("time").value);
}
function openEditor(id = null) {
  editingId = id;
  const task = tasks.find(t => t.id === id);
  editingSnapshot = task ? JSON.stringify(task) : null;
  const dialog = $("#task-dialog");
  if (!dialog) return;
  const form = $("#task-form");
  form.reset();
  if (!task && section === "sites" && siteCategory !== "" && siteCategory !== "未分类") form.elements.namedItem("category").value = siteCategory;
  $("#form-error").classList.add("hidden");
  const website = Boolean(task?.url || (!task && section === "sites"));
  $("#dialog-title").textContent = task ? (website ? "编辑网站" : "编辑便签") : website ? "添加网站" : "新建任务";
  $("#editor-title-label").textContent = website ? "网站名称" : "写下这件事";
  form.elements.namedItem("title").placeholder = website ? "例如：Linux DO" : "例如：今天记得喝水";
  $("#editor-details").open = Boolean(task?.url || task?.category || (!task && section === "sites"));
  if (task) {
    for (const key of ["title", "category", "repeat", "date", "time", "url"]) {
      form.elements.namedItem(key).value = task[key] || "";
    }
    form.elements.namedItem("remind").checked = Boolean(task.remind);
    $$('input[name="weekday"]', form).forEach(input => { input.checked = (task.weekdays || []).includes(Number(input.value)); });
  }
  toggleFormFields();
  dialog.showModal();
  form.elements.namedItem("title").focus();
}
function formError(message) {
  const el = $("#form-error");
  el.textContent = message;
  el.classList.remove("hidden");
}
async function submitEditor(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (form.dataset.saving) return;
  const f = new FormData(form);
  const title = String(f.get("title") || "").trim();
  const repeat = String(f.get("repeat") || "daily");
  const rawUrl = String(f.get("url") || "").trim();
  const url = safeUrl(rawUrl);
  const weekdays = f.getAll("weekday").map(Number);
  const time = String(f.get("time") || "");
  if (!title) return formError("请输入任务名称。");
  if (!editingId && section === "sites" && !rawUrl) { $("#editor-details").open = true; return formError("请输入网站地址。"); }
  if (rawUrl && !url) { $("#editor-details").open = true; return formError("网站地址必须以 http:// 或 https:// 开头。"); }
  if (repeat === "weekly" && !weekdays.length) return formError("每周任务至少选择一天。");
  if (f.has("remind") && !time) return formError("开启提醒后，需要设置提醒时间。");
  const original = tasks.find(t => t.id === editingId);
  const updated = {
    id: original?.id || uid(), title, category: String(f.get("category") || "").trim(),
    repeat, weekdays: repeat === "weekly" ? weekdays : [],
    date: repeat === "once" ? String(f.get("date") || "") : "",
    time, url, remind: f.has("remind"),
    completed: original?.repeat === repeat && !(repeat === "once" && original?.date !== (String(f.get("date") || ""))) ? (original?.completed || []) : [],
    noteOrder: original?.noteOrder, createdAt: original?.createdAt || Date.now()
  };
  if (editingId && !original) return formError("任务已被其他页面删除，请关闭窗口并重试。");
  const change = latest => {
    if (!editingId) return [...latest, updated];
    const current = latest.find(t => t.id === editingId);
    if (!current || JSON.stringify(current) !== editingSnapshot) return null;
    return latest.map(t => t.id === editingId ? updated : t);
  };
  form.dataset.saving = "true";
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    if (await persist(change, original ? "任务已更新" : "任务已添加")) editingId = null;
  } finally { delete form.dataset.saving; button.disabled = false; }
}
async function removeTask(id) {
  const item = tasks.find(t => t.id === id);
  if (!item) return;
  await persist(latest => { const current = latest.find(t => t.id === id); return current && JSON.stringify(current) === JSON.stringify(item) ? latest.map(t => t.id === id ? { ...t, deletedAt: Date.now() } : t) : null; }, "已移到回收站，可在侧栏恢复");
}
function exportData() {
  const content = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), tasks }, null, 2);
  const objectUrl = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = objectUrl; anchor.download = "dailydock-" + dayKey() + ".json";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  notify("已导出备份文件");
}
function parseBackup(payload) {
  if (!payload || !Array.isArray(payload.tasks) || payload.tasks.length > 3000) throw new Error("备份格式不正确或任务数量过多。");
  const ids = new Set();
  return payload.tasks.map(source => {
    if (!source || typeof source !== "object" || typeof source.title !== "string" || !source.title.trim()) throw new Error("发现无效任务。");
    const candidate = String(source.id || "").slice(0, 100);
    const id = candidate && !ids.has(candidate) ? candidate : uid();
    ids.add(id);
    const repeat = ["daily","weekly","once"].includes(source.repeat) ? source.repeat : "daily";
    const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(source.time || "") ? source.time : "";
    return {
      id, title: source.title.slice(0,160), category: String(source.category || "").slice(0,40),
      repeat, weekdays: Array.isArray(source.weekdays) ? [...new Set(source.weekdays.filter(x => Number.isInteger(x) && x >= 0 && x <= 6))] : [],
      date: /^\d{4}-\d{2}-\d{2}$/.test(source.date || "") ? source.date : "",
      time, url: safeUrl(source.url), remind: Boolean(source.remind) && Boolean(time),
      completed: Array.isArray(source.completed) ? [...new Set(source.completed.filter(x => x === "__once__" || (typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x))))] : [],
      noteOrder: Number.isFinite(source.noteOrder) ? source.noteOrder : undefined,
      deletedAt: Number.isFinite(source.deletedAt) && source.deletedAt > 0 ? source.deletedAt : undefined,
      createdAt: Number.isFinite(source.createdAt) ? source.createdAt : Date.now()
    };
  });
}
async function importData(file) {
  if (!file) return;
  if (file.size > 20_000_000) return notify("文件超过 20MB，无法导入。");
  try {
    const incoming = parseBackup(JSON.parse(await file.text()));
    if (!confirm("导入将覆盖当前全部任务。请确认已经备份现有数据。")) return;
    if (await persist(incoming, "已导入 " + incoming.length + " 项任务")) {
      section = "today"; filter = "all"; search = ""; render();
    }
  } catch (err) { notify("导入失败：" + err.message); }
}
function bind() {
  $$("[data-toggle]").forEach(el => { el.addEventListener("change", () => toggle(el.dataset.toggle)); });
  $$("[data-open]").forEach(el => { el.addEventListener("click", () => {
    const task = tasks.find(t => t.id === el.dataset.open);
    const url = safeUrl(task?.url);
    if (url) { if (extensionMode) chrome.tabs.create({ url }); else window.open(url, "_blank", "noopener,noreferrer"); } else notify("网址无效，请在管理页中修改。");
  }); });
  $$("[data-manage]").forEach(el => el.addEventListener("click", () => chrome.runtime.openOptionsPage()));
  $("#quick-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    const value = $("#quick-title").value;
    const button = e.currentTarget.querySelector('button[type="submit"]');
    if (button.disabled) return;
    button.disabled = true;
    try { await addQuick(value); } finally { button.disabled = false; }
  });
  if (popup) return;
  $("#note-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    const input = $("#note-input");
    const button = event.currentTarget.querySelector('button[type="submit"]');
    if (button.disabled) return;
    button.disabled = true;
    try { await addNote(input.value); } finally { button.disabled = false; }
  });
  $$("[data-nav]").forEach(el => el.addEventListener("click", () => { section = el.dataset.nav; filter = "all"; siteCategory = ""; search = ""; render(); }));
  $("[data-sidebar]")?.addEventListener("click", async () => {
    const nextSettings = { ...settings, sidebarCollapsed: !settings.sidebarCollapsed };
    try { await storage.set({ [SETTINGS_KEY]: nextSettings }); settings = nextSettings; render(); $("[data-sidebar]")?.focus(); }
    catch { notify("侧栏设置保存失败。"); }
  });
  $("[data-tidy]")?.addEventListener("click", () => reorderNotes(null, null, true));
  $$("[data-move]").forEach(el => el.addEventListener("click", () => reorderNotes(el.dataset.move, null, false, Number(el.dataset.direction))));
  $$("[data-restore]").forEach(el => el.addEventListener("click", () => persist(latest => latest.map(t => t.id === el.dataset.restore && t.deletedAt ? { ...t, deletedAt: undefined } : t), "已恢复")));
  $$("[data-purge]").forEach(el => el.addEventListener("click", () => {
    const item = tasks.find(t => t.id === el.dataset.purge && t.deletedAt);
    if (item && confirm('永久删除「' + item.title + '」？此操作无法撤销。')) void persist(latest => latest.filter(t => t.id !== item.id || !t.deletedAt), "已永久删除");
  }));
  bindNoteDragging();
  $$("[data-category]").forEach(el => el.addEventListener("click", () => { siteCategory = el.dataset.category; render(); }));
  $("[data-clear-search]")?.addEventListener("click", () => { search = ""; render(); $("#task-search")?.focus(); });
  $$("[data-filter]").forEach(el => el.addEventListener("click", () => { filter = el.dataset.filter; render(); }));
  const updateSearch = event => {
    if (event.isComposing) return;
    const target = event.currentTarget; const start = target.selectionStart; const end = target.selectionEnd;
    search = target.value; render();
    const next = $("#task-search"); next?.focus(); if (start !== null && end !== null) next?.setSelectionRange(start, end);
  };
  $("#task-search")?.addEventListener("input", updateSearch);
  $("#task-search")?.addEventListener("compositionend", updateSearch);
  $("[data-add]")?.addEventListener("click", () => openEditor());
  $$("[data-edit]").forEach(el => el.addEventListener("click", () => openEditor(el.dataset.edit)));
  $$("[data-delete]").forEach(el => el.addEventListener("click", () => removeTask(el.dataset.delete)));
  $$("[data-close]").forEach(el => el.addEventListener("click", () => $("#task-dialog")?.close()));
  $("#task-dialog")?.addEventListener("close", () => render());
  $("#task-form")?.addEventListener("submit", submitEditor);
  $("#task-form [name=repeat]")?.addEventListener("change", toggleFormFields);
  $("#task-form [name=remind]")?.addEventListener("change", toggleFormFields);
  $("[data-notification-permission]")?.addEventListener("click", async () => {
    try { await Notification.requestPermission(); render(); }
    catch { notify("无法请求通知权限，请检查浏览器设置。"); }
  });
  $("[data-test-sound]")?.addEventListener("click", async () => {
    const unlocked = await unlockAudio();
    const sounded = unlocked && playReminderSound();
    $("#reminder-test-status").textContent = sounded ? "已播放提醒音；如果听不到，请检查设备音量。" : "无法播放提醒音，请检查浏览器声音权限。";
  });
  $("[data-test-reminder]")?.addEventListener("click", async event => {
    const sounded = await unlockAudio();
    clearTimeout(testTimer);
    const button = event.currentTarget;
    button.disabled = true;
    $("#reminder-test-status").textContent = "测试已开始，10 秒后触发。请保持页面打开。" + (sounded ? "" : " 提醒音可能被浏览器阻止。");
    testTimer = setTimeout(async () => {
      const result = await showReminder("这是一次提醒测试", true);
      const status = $("#reminder-test-status");
      if (status) status.textContent = "测试已触发。" + (result.desktop ? "已发送桌面通知。" : "未发送桌面通知，请先开启通知权限。") + (result.sound ? " 已尝试播放提醒音。" : " 提醒音未能播放，请检查浏览器声音权限。");
      const current = $("[data-test-reminder]"); if (current) current.disabled = false;
      testTimer = null;
    }, 10000);
  });
  $$("button[data-theme]").forEach(el => el.addEventListener("click", async () => {
    const nextSettings = { ...settings, theme: el.dataset.theme };
    try { await storage.set({ [SETTINGS_KEY]: nextSettings }); settings = nextSettings; applyTheme(); render(); notify("已保存外观设置"); }
    catch { notify("外观设置保存失败，请检查浏览器存储。"); }
  }));
  $("[data-export]")?.addEventListener("click", exportData);
  $("[data-import]")?.addEventListener("click", () => $("#import-file")?.click());
  $("#import-file")?.addEventListener("change", async e => { const input = e.currentTarget; const file = input.files?.[0]; await importData(file); input.value = ""; });
}
function bindNoteDragging() {
  $$("[data-drag]").forEach(handle => handle.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    const source = handle.closest("[data-note]");
    const startX = event.clientX, startY = event.clientY;
    let target = null, moving = false;
    handle.setPointerCapture(event.pointerId);
    const move = e => {
      if (!moving && Math.hypot(e.clientX - startX, e.clientY - startY) < 8) return;
      moving = true; source.classList.add("dragging");
      source.style.setProperty("--drag-x", `${e.clientX - startX}px`);
      source.style.setProperty("--drag-y", `${e.clientY - startY}px`);
      const found = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-note]");
      if (target && target !== found) target.classList.remove("drop-target");
      target = found && found !== source ? found : null;
      target?.classList.add("drop-target");
    };
    const end = e => {
      handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", end); handle.removeEventListener("pointercancel", end);
      source.classList.remove("dragging"); source.style.removeProperty("--drag-x"); source.style.removeProperty("--drag-y");
      target?.classList.remove("drop-target");
      if (e.type === "pointerup" && moving && target) void reorderNotes(source.dataset.note, target.dataset.note);
    };
    handle.addEventListener("pointermove", move); handle.addEventListener("pointerup", end); handle.addEventListener("pointercancel", end);
  }));
}
function renderExternal() {
  if ($("#task-dialog")?.open) return;
  const active = document.activeElement;
  const input = active?.id === "quick-title" || active?.id === "task-search" || active?.id === "note-input" ? active : null;
  const editing = Boolean(input);
  const value = editing ? input.value : "";
  const start = editing ? input.selectionStart : null;
  const end = editing ? input.selectionEnd : null;
  render();
  if (editing) {
    const replacement = document.getElementById(input.id);
    if (replacement) { replacement.value = value; replacement.focus(); if (start !== null && end !== null) replacement.setSelectionRange(start, end); }
  }
}
function render() {
  $("#app").innerHTML = popup ? renderPopup() : renderOptions();
  bind();
}
if (extensionMode) chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes[TASKS_KEY] && JSON.stringify(changes[TASKS_KEY].newValue) !== JSON.stringify(tasks)) { tasks = Array.isArray(changes[TASKS_KEY].newValue) ? changes[TASKS_KEY].newValue : []; renderExternal(); }
  if (changes[SETTINGS_KEY]) { settings = { theme: "system", ...(changes[SETTINGS_KEY].newValue || {}) }; applyTheme(); renderExternal(); }
});
if (!extensionMode) window.addEventListener("storage", event => {
  if (event.key !== TASKS_KEY && event.key !== SETTINGS_KEY && event.key !== null) return;
  void storage.get([TASKS_KEY, SETTINGS_KEY]).then(data => {
    tasks = Array.isArray(data[TASKS_KEY]) ? data[TASKS_KEY] : [];
    settings = { theme: "system", ...(data[SETTINGS_KEY] || {}) };
    applyTheme();
    renderExternal();
  }).catch(() => notify("无法同步其他标签页的数据。"));
});
const media = matchMedia("(prefers-color-scheme: dark)");
media.addEventListener?.("change", applyTheme);
document.addEventListener("visibilitychange", () => { if (!document.hidden) { renderExternal(); if (!extensionMode) void checkWebReminders(); } });
document.addEventListener("pointerdown", () => { void unlockAudio(); }, { once: true });
document.addEventListener("keydown", e => {
  if (e.key === "/" && !["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName) && !$("#task-dialog")?.open) {
    e.preventDefault(); (popup ? $("#quick-title") : $("#task-search"))?.focus();
  }
});
async function initializeSites() {
  const initialize = async () => {
    const data = await storage.get([TASKS_KEY, SETTINGS_KEY]);
    const preferences = { theme: "system", ...(data[SETTINGS_KEY] || {}) };
    if (preferences.starterSitesAdded) return;
    const existing = Array.isArray(data[TASKS_KEY]) ? data[TASKS_KEY] : [];
    const urls = new Set(existing.map(task => safeUrl(task.url)).filter(Boolean));
    const additions = starterSites.filter(site => !urls.has(safeUrl(site.url))).map((site, index) => ({
      ...site, id: uid(), repeat: "daily", weekdays: [], date: "", time: "", remind: false,
      completed: [], createdAt: Date.now() + index
    }));
    await storage.set({ [TASKS_KEY]: [...existing, ...additions], [SETTINGS_KEY]: { ...preferences, starterSitesAdded: true } });
  };
  if (globalThis.navigator?.locks) await navigator.locks.request("dailydock.tasks", initialize);
  else await initialize();
}
async function start() {
  try {
    await initializeSites();
    const data = await storage.get([TASKS_KEY, SETTINGS_KEY]);
    tasks = Array.isArray(data[TASKS_KEY]) ? data[TASKS_KEY] : [];
    settings = { theme: "system", ...(data[SETTINGS_KEY] || {}) };
    applyTheme(); render();
    if (!extensionMode) { void checkWebReminders(); setInterval(() => { void checkWebReminders(); }, 15000); }
  } catch (e) { $("#app").innerHTML = '<div class="empty"><div class="empty-title">无法读取本地任务</div>请检查浏览器存储设置后重新打开。</div>'; }
}
start();
