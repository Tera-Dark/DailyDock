const TASKS_KEY = "dailydock.tasks";
const SETTINGS_KEY = "dailydock.settings";
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const popup = document.body.classList.contains("popup");
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
const pad = n => String(n).padStart(2, "0");
const dayKey = (d = new Date()) => [d.getFullYear(), pad(d.getMonth() + 1), pad(d.getDate())].join("-");
const uid = () => crypto.randomUUID();
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
  repeat: '<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>'
};
function icon(name, size = 18) {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (symbols[name] || symbols.check) + '</svg>';
}
let tasks = [];
let settings = { theme: "system" };
let section = "today";
let filter = "all";
let search = "";
let toastTimer = null;
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
function currentTasks() {
  let list = section === "all" ? tasks : section === "sites" ? tasks.filter(x => x.url) : tasks.filter(x => isDue(x));
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
    (task.url ? '<button type="button" class="open-btn" data-open="' + escapeHtml(task.id) + '" title="在新标签页打开签到网站">' + (popup ? '打开' : '') + icon("external", 15) + '</button>' : '') +
    (!popup ? '<button type="button" class="icon-btn" data-edit="' + escapeHtml(task.id) + '" aria-label="编辑：' + escapeHtml(task.title) + '" title="编辑">' + icon("edit", 16) + '</button>' +
      '<button type="button" class="icon-btn critical" data-delete="' + escapeHtml(task.id) + '" aria-label="删除：' + escapeHtml(task.title) + '" title="删除">' + icon("trash", 16) + '</button>' : '') +
    '</div></div>';
}
function listMarkup(list, emptyTitle, emptyHelp) {
  return list.length ? '<div class="list">' + list.map(taskRow).join("") + '</div>' :
    '<div class="empty"><div class="empty-title">' + escapeHtml(emptyTitle) + '</div><div class="tiny">' + escapeHtml(emptyHelp) + '</div></div>';
}
function progressMarkup() {
  const due = tasks.filter(t => isDue(t));
  const completed = due.filter(isDone).length;
  const percent = due.length ? Math.round(completed * 100 / due.length) : 0;
  return { due, completed, percent };
}
function quickForm() {
  return '<form id="quick-form" class="quick-form" autocomplete="off"><label class="sr-only" for="quick-title">快速添加每日任务</label>' +
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
  return '<button type="button" class="nav-button' + (section === id ? ' active' : '') + '" data-nav="' + id + '"' + (section === id ? ' aria-current="page"' : '') + '>' +
    icon(name, 18) + '<span>' + text + '</span>' + (count != null ? '<span class="nav-count">' + count + '</span>' : '') + '</button>';
}
function viewName() { return ({ today: "今天", all: "全部任务", sites: "网站签到", settings: "偏好与数据" })[section]; }
function renderOptions() {
  const stat = progressMarkup();
  const title = viewName();
  const help = ({ today: "专注今天真正需要完成的事情。", all: "所有单次、周期与未来任务集中管理。", sites: "集中打开常用网站，签到后自行确认完成。", settings: "外观、数据备份与本地隐私设置。" })[section];
  return '<div class="options-shell"><aside class="sidebar">' + logo() +
    '<nav class="nav" aria-label="主要导航">' +
    navItem("today", "今天", "calendar", stat.due.filter(t => !isDone(t)).length) +
    navItem("all", "全部任务", "list", tasks.length) +
    navItem("sites", "网站签到", "link", tasks.filter(t => t.url).length) +
    navItem("settings", "偏好与数据", "settings") + '</nav>' +
    '<div class="side-bottom"><div class="tiny muted">安静地记住每一件小事。</div><p>本地存储 · 无账户 · 无云端</p></div></aside>' +
    '<main class="workspace"><div class="workspace-inner">' +
    '<header class="page-top"><div class="page-heading"><h1>' + title + '</h1><p>' + help + '</p></div>' +
    (section === "settings" ? '' : '<div class="page-actions"><button class="btn primary" data-add>' + icon("plus", 16) + ' 新建任务</button></div>') + '</header>' +
    (section === "settings" ? settingsMarkup() : listViewMarkup(stat)) +
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
  const noData = tasks.length === 0;
  const emptyTitle = noData ? "还没有任务" : search ? "没有找到匹配的任务" : filter === "done" ? "尚无已完成事项" : filter === "pending" ? "暂时没有待完成事项" : "这里没有任务";
  const emptyHelp = noData ? "点击「新建任务」开始使用 DailyDock。" : search ? "试着更换搜索关键词。" : section === "sites" ? "在任务编辑中添加一个网站地址。" : "可以调整筛选条件，或新建一个任务。";
  return intro + '<div class="search-bar"><div class="search-wrap">' + icon("search", 16) +
    '<label class="sr-only" for="task-search">搜索任务</label><input id="task-search" type="search" placeholder="搜索任务、类别或网址" value="' + escapeHtml(search) + '"></div>' +
    '<span class="tiny muted">' + shown.length + ' 项</span></div>' +
    '<div class="filters" role="group" aria-label="任务状态筛选">' +
    [["all", "全部"], ["pending", "待完成"], ["done", "已完成"]].map(([value,label]) =>
      '<button type="button" class="filter' + (filter === value ? ' active' : '') + '" data-filter="' + value + '" aria-pressed="' + (filter === value) + '">' + label + '</button>').join("") + '</div>' +
    listMarkup(shown, emptyTitle, emptyHelp) +
    '<div class="note">网页签到不会自动完成；点击「打开」后，请在网站签到并回来勾选。提醒需保持浏览器运行。</div>';
}
function settingsMarkup() {
  return '<section><h2 style="font-size:16px;font-weight:650;margin-bottom:6px">外观</h2>' +
    '<p class="muted tiny">按照系统自动选择主题，或指定浅色与深色。</p>' +
    '<div class="settings-tools">' +
    [["system", "跟随系统"], ["light", "浅色"], ["dark", "深色"]].map(([val,label]) =>
      '<button class="btn ' + (settings.theme === val ? 'primary' : '') + '" data-theme="' + val + '" aria-pressed="' + (settings.theme === val) + '">' +
      icon(val === "dark" ? "moon" : "sun", 16) + label + '</button>').join("") + '</div></section>' +
    '<div class="divider" style="margin:26px 0"></div><section><h2 style="font-size:16px;font-weight:650;margin-bottom:6px">本地数据</h2>' +
    '<p class="muted tiny">数据存放在此浏览器的扩展存储中。卸载或清理数据可能造成丢失，建议定期导出备份。</p>' +
    '<div class="settings-tools"><button class="btn" data-export>' + icon("download", 16) + ' 导出 JSON</button>' +
    '<button class="btn" data-import>' + icon("upload", 16) + ' 导入 JSON</button></div>' +
    '<p class="note">导入将覆盖当前全部任务，操作前请先备份。DailyDock 不会上传任务或保存网站的登录凭证。</p></section>';
}
function taskDialogMarkup() {
  return '<dialog id="task-dialog" class="task-dialog" aria-labelledby="dialog-title">' +
    '<div class="dialog-top"><h2 id="dialog-title">新建任务</h2><button type="button" class="icon-btn" data-close aria-label="关闭编辑窗口">' + icon("close", 18) + '</button></div>' +
    '<form id="task-form"><div class="form-grid">' +
    '<label class="field wide"><span>任务名称</span><input name="title" required maxlength="160" placeholder="例如：论坛每日签到"></label>' +
    '<label class="field"><span>类别</span><input name="category" maxlength="40" placeholder="网页签到 / 学习 / 生活"></label>' +
    '<label class="field"><span>重复频率</span><select name="repeat"><option value="daily">每天</option><option value="weekly">指定星期</option><option value="once">单次任务</option></select></label>' +
    '<div class="field wide hidden" id="weekdays-wrap"><span>重复日期</span><div class="weekdays">' +
    [1,2,3,4,5,6,0].map(x => '<label class="day-label"><input type="checkbox" name="weekday" value="' + x + '">' + weekdays[x] + '</label>').join("") + '</div></div>' +
    '<label class="field hidden" id="date-wrap"><span>任务日期</span><input type="date" name="date"><span class="help">不填视为今天即可处理。</span></label>' +
    '<label class="field"><span>提醒时间</span><input type="time" name="time"></label>' +
    '<label class="field wide"><span>网站地址（可选）</span><input name="url" type="url" placeholder="https://example.com"><span class="help">只支持 http / https，打开网页不会自动标记完成。</span></label>' +
    '<label class="field wide reminder-label"><input name="remind" type="checkbox"><span>到点发送浏览器通知</span></label>' +
    '<div class="field-error hidden" id="form-error" role="alert"></div></div>' +
    '<div class="dialog-bottom"><button type="button" class="btn" data-close>取消</button><button type="submit" class="btn primary">保存任务</button></div></form></dialog>';
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
async function persist(next, message) {
  const previous = tasks;
  tasks = next;
  try {
    await chrome.storage.local.set({ [TASKS_KEY]: next });
    render();
    if (message) notify(message);
    return true;
  } catch (err) {
    tasks = previous;
    render();
    notify("保存失败，请检查浏览器存储空间。");
    return false;
  }
}
async function toggle(id) {
  const next = tasks.map(t => {
    if (t.id !== id) return t;
    const key = t.repeat === "once" ? "__once__" : dayKey();
    const completed = isDone(t) ? (t.completed || []).filter(x => x !== key) : [...new Set([...(t.completed || []), key])];
    return { ...t, completed };
  });
  await persist(next);
}
async function addQuick(title) {
  const cleaned = title.trim();
  if (!cleaned) return;
  if (cleaned.length > 160) return notify("任务名称太长。");
  const task = {
    id: uid(), title: cleaned, category: "", repeat: "daily", weekdays: [],
    date: "", time: "", url: "", remind: false, completed: [], createdAt: Date.now()
  };
  if (await persist([...tasks, task], "已添加每日任务")) $("#quick-title")?.focus();
}
let editingId = null;
function toggleFormFields() {
  const form = $("#task-form");
  if (!form) return;
  const type = form.elements.namedItem("repeat").value;
  $("#weekdays-wrap")?.classList.toggle("hidden", type !== "weekly");
  $("#date-wrap")?.classList.toggle("hidden", type !== "once");
}
function openEditor(id = null) {
  editingId = id;
  const task = tasks.find(t => t.id === id);
  const dialog = $("#task-dialog");
  if (!dialog) return;
  const form = $("#task-form");
  form.reset();
  $("#form-error").classList.add("hidden");
  $("#dialog-title").textContent = task ? "编辑任务" : "新建任务";
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
  const f = new FormData(form);
  const title = String(f.get("title") || "").trim();
  const repeat = String(f.get("repeat") || "daily");
  const rawUrl = String(f.get("url") || "").trim();
  const url = safeUrl(rawUrl);
  const weekdays = f.getAll("weekday").map(Number);
  const time = String(f.get("time") || "");
  if (!title) return formError("请输入任务名称。");
  if (rawUrl && !url) return formError("网站地址必须以 http:// 或 https:// 开头。");
  if (repeat === "weekly" && !weekdays.length) return formError("每周任务至少选择一天。");
  if (f.has("remind") && !time) return formError("开启提醒后，需要设置提醒时间。");
  const original = tasks.find(t => t.id === editingId);
  const updated = {
    id: original?.id || uid(), title, category: String(f.get("category") || "").trim(),
    repeat, weekdays: repeat === "weekly" ? weekdays : [],
    date: repeat === "once" ? String(f.get("date") || "") : "",
    time, url, remind: f.has("remind"),
    completed: original?.repeat === repeat ? (original?.completed || []) : [],
    createdAt: original?.createdAt || Date.now()
  };
  const next = original ? tasks.map(t => t.id === original.id ? updated : t) : [...tasks, updated];
  if (await persist(next, original ? "任务已更新" : "任务已添加")) {
    $("#task-dialog")?.close();
    editingId = null;
  }
}
async function removeTask(id) {
  const item = tasks.find(t => t.id === id);
  if (!item) return;
  if (!confirm('删除「' + item.title + '」？此操作会同时删除完成记录。')) return;
  await persist(tasks.filter(t => t.id !== id), "任务已删除");
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
      completed: Array.isArray(source.completed) ? [...new Set(source.completed.filter(x => x === "__once__" || (typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x))).slice(-400))] : [],
      createdAt: Number.isFinite(source.createdAt) ? source.createdAt : Date.now()
    };
  });
}
async function importData(file) {
  if (!file) return;
  if (file.size > 2_000_000) return notify("文件超过 2MB，无法导入。");
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
    if (url) chrome.tabs.create({ url }); else notify("网址无效，请在管理页中修改。");
  }); });
  $$("[data-manage]").forEach(el => el.addEventListener("click", () => chrome.runtime.openOptionsPage()));
  $("#quick-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    const value = $("#quick-title").value;
    await addQuick(value);
  });
  if (popup) return;
  $$("[data-nav]").forEach(el => el.addEventListener("click", () => { section = el.dataset.nav; filter = "all"; search = ""; render(); }));
  $$("[data-filter]").forEach(el => el.addEventListener("click", () => { filter = el.dataset.filter; render(); }));
  $("#task-search")?.addEventListener("input", event => {
    const target = event.currentTarget; const caret = target.selectionStart; search = target.value; render();
    const next = $("#task-search"); next?.focus(); if (caret !== null) next?.setSelectionRange(caret, caret);
  });
  $("[data-add]")?.addEventListener("click", () => openEditor());
  $$("[data-edit]").forEach(el => el.addEventListener("click", () => openEditor(el.dataset.edit)));
  $$("[data-delete]").forEach(el => el.addEventListener("click", () => removeTask(el.dataset.delete)));
  $$("[data-close]").forEach(el => el.addEventListener("click", () => $("#task-dialog")?.close()));
  $("#task-form")?.addEventListener("submit", submitEditor);
  $("#task-form [name=repeat]")?.addEventListener("change", toggleFormFields);
  $$("[data-theme]").forEach(el => el.addEventListener("click", async () => {
    settings = { ...settings, theme: el.dataset.theme };
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings }); applyTheme(); render(); notify("已保存外观设置");
  }));
  $("[data-export]")?.addEventListener("click", exportData);
  $("[data-import]")?.addEventListener("click", () => $("#import-file")?.click());
  $("#import-file")?.addEventListener("change", async e => { await importData(e.currentTarget.files?.[0]); e.currentTarget.value = ""; });
}
function render() {
  $("#app").innerHTML = popup ? renderPopup() : renderOptions();
  bind();
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes[TASKS_KEY]) { tasks = Array.isArray(changes[TASKS_KEY].newValue) ? changes[TASKS_KEY].newValue : []; render(); }
  if (changes[SETTINGS_KEY]) { settings = { theme: "system", ...(changes[SETTINGS_KEY].newValue || {}) }; applyTheme(); if (!popup) render(); }
});
const media = matchMedia("(prefers-color-scheme: dark)");
media.addEventListener?.("change", applyTheme);
document.addEventListener("visibilitychange", () => { if (!document.hidden) render(); });
document.addEventListener("keydown", e => {
  if (e.key === "/" && !["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName) && !$("#task-dialog")?.open) {
    e.preventDefault(); (popup ? $("#quick-title") : $("#task-search"))?.focus();
  }
});
async function start() {
  try {
    const data = await chrome.storage.local.get([TASKS_KEY, SETTINGS_KEY]);
    tasks = Array.isArray(data[TASKS_KEY]) ? data[TASKS_KEY] : [];
    settings = { theme: "system", ...(data[SETTINGS_KEY] || {}) };
    applyTheme(); render();
  } catch (e) { $("#app").innerHTML = '<div class="empty"><div class="empty-title">无法读取本地任务</div>请检查扩展权限后重新打开。</div>'; }
}
start();
