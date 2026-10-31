import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const app = readFileSync(new URL("../extension/app.js", import.meta.url), "utf8");
const background = readFileSync(new URL("../extension/background.js", import.meta.url), "utf8");

function makeApp(isPopup, tasks = []) {
  const root = { innerHTML: "" };
  const document = {
    body: { classList: { contains: () => isPopup } },
    documentElement: { dataset: {} },
    querySelector: selector => selector === "#app" ? root : null,
    querySelectorAll: () => [],
    addEventListener() {},
    hidden: false
  };
  const chrome = {
    runtime: { id: "test-extension" },
    storage: {
      local: { async get() { return { "dailydock.tasks": tasks, "dailydock.settings": { starterSitesAdded: true, theme: "system" } }; } },
      onChanged: { addListener() {} }
    }
  };
  const ctx = { document, chrome, crypto: { randomUUID: () => "test-id" },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    setTimeout, clearTimeout, URL, console };
  runInNewContext(app + "\nglobalThis.test = { isDue, isDone, safeUrl, renderPopup, renderOptions, parseBackup, progressMarkup, parseQuickNote, dueAtMinute };", ctx);
  return { ...ctx.test, root };
}
const current = new Date(2026, 9, 30, 12, 0);
const popup = makeApp(true);
const options = makeApp(false);
const populated = makeApp(false, [{ id: "p", title: "测试", repeat: "daily", completed: [] }]);
await new Promise(resolve => setImmediate(resolve));
assert.equal(populated.progressMarkup().due.length, 1);
assert.equal(populated.progressMarkup().completed, 0);
assert.match(app, /\$\$\("button\[data-theme\]"\)/, "Theme listeners must not bind to the document root");
assert.equal(popup.isDue({ repeat: "daily" }, current), true);
assert.equal(popup.isDue({ repeat: "weekly", weekdays: [5] }, current), true);
assert.equal(popup.isDue({ repeat: "weekly", weekdays: [2] }, current), false);
assert.equal(popup.isDue({ repeat: "once", date: "2026-11-01" }, current), false);
assert.equal(popup.isDue({ repeat: "once", date: "2026-10-29" }, current), true);
assert.equal(popup.isDone({ repeat: "once", completed: ["__once__"] }, current), true);
assert.equal(popup.isDone({ repeat: "daily", completed: ["2026-10-29"] }, current), false);
assert.equal(popup.dueAtMinute({ repeat: "daily", time: "12:00", remind: true, completed: [] }, current), true);
assert.equal(popup.dueAtMinute({ repeat: "daily", time: "12:01", remind: true, completed: [] }, current), false);
assert.equal(popup.dueAtMinute({ repeat: "daily", time: "12:00", remind: true, completed: ["2026-10-30"] }, current), false);
assert.equal(popup.dueAtMinute({ repeat: "daily", time: "12:00", remind: true, completed: [], deletedAt: 123 }, current), false);
assert.equal(popup.safeUrl("javascript:alert(1)"), "");
assert.equal(popup.safeUrl("https://example.com").startsWith("https:"), true);
assert.match(popup.renderPopup(), /今日清单/);
assert.match(popup.renderPopup(), /quick-form/);
assert.match(options.renderOptions(), /task-dialog/);
assert.match(options.renderOptions(), /网站签到/);
const imported = options.parseBackup({ tasks: [{ title: "<script>x</script>", repeat: "daily", completed: [] }] });
assert.equal(imported.length, 1);
assert.equal(imported[0].title, "<script>x</script>");
const recovered = options.parseBackup({ tasks: [{ id: "n", title: "便签", deletedAt: 12345, noteOrder: 2, completed: ["__once__"] }] });
assert.equal(recovered[0].deletedAt, 12345);
assert.equal(recovered[0].noteOrder, 2);
assert.equal(recovered[0].completed[0], "__once__");
const deleted = makeApp(false, [{ id: "d", title: "已移除", repeat: "daily", completed: [], deletedAt: 12345 }]);
await new Promise(resolve => setImmediate(resolve));
assert.equal(deleted.progressMarkup().due.length, 0, "Trash must not count toward progress");
const history = Array.from({ length: 500 }, (_, i) => `2025-${String(Math.floor(i / 31) + 1).padStart(2, "0")}-${String(i % 31 + 1).padStart(2, "0")}`);
assert.equal(options.parseBackup({ tasks: [{ title: "历史", completed: history }] })[0].completed.length, 500, "Import must retain long completion histories");
assert.match(options.renderOptions(), /task-search/);
assert.equal(options.parseQuickNote("喝水").title, "喝水");
assert.equal(options.parseQuickNote("喝水").url, "");
assert.equal(options.parseQuickNote("示例 https://example.com/path").title, "示例");
assert.equal(options.parseQuickNote("example.com").url, "https://example.com/");
assert.throws(() => options.parseQuickNote("ftp://example.com"), /网址只支持/);

// Exercise the web reminder loop with a fixed clock and local storage.
const delivered = [];
const local = new Map([
  ["dailydock.settings", JSON.stringify({ starterSitesAdded: true, theme: "system" })],
  ["dailydock.tasks", JSON.stringify([{ id: "reminder", title: "定时测试", repeat: "daily", time: "12:00", remind: true, completed: [] }])]
]);
const toast = { hidden: true, textContent: "" };
const webDoc = {
  body: { classList: { contains: () => false }, append() {} }, documentElement: { dataset: {} },
  querySelector: selector => selector === "#app" ? { innerHTML: "" } : selector === "#status-toast" ? toast : null,
  querySelectorAll: () => [], addEventListener() {}, hidden: false
};
class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [2026, 9, 30, 12, 0, 5])); } }
class FakeNotification { static permission = "granted"; constructor(title, options) { delivered.push({ title, ...options }); } }
const webCtx = {
  document: webDoc, window: { addEventListener() {} }, localStorage: { getItem: key => local.get(key) ?? null, setItem: (key, value) => local.set(key, value) },
  Notification: FakeNotification, Date: FixedDate, crypto: { randomUUID: () => "web-id" },
  matchMedia: () => ({ matches: false, addEventListener() {} }), setInterval() {}, setTimeout() {}, clearTimeout() {}, URL, console
};
runInNewContext(app + "\nglobalThis.test = { checkWebReminders };", webCtx);
await new Promise(resolve => setImmediate(resolve));
await webCtx.test.checkWebReminders();
assert.equal(delivered.length, 1, "A due reminder should be delivered once, even after another check");
assert.equal(delivered[0].body, "定时测试");
const callbacks = {};
const alarms = new Map();
const badge = [];
const tasks = [{ id: "alpha", title: "签到", repeat: "daily", time: "23:59", remind: true, completed: [] }];
const stub = {
  storage: { local: { async get() { return { "dailydock.tasks": tasks }; } }, onChanged: { addListener(fn) { callbacks.changed = fn; } } },
  alarms: {
    async getAll() { return [...alarms.entries()].map(([name, scheduledTime]) => ({ name, scheduledTime })); },
    async clearAll() { alarms.clear(); },
    async create(name, info) { alarms.set(name, info.when); },
    onAlarm: { addListener(fn) { callbacks.alarm = fn; } }
  },
  action: {
    async setBadgeText(args) { badge.push(args.text); },
    async setBadgeBackgroundColor() {}
  },
  runtime: {
    onInstalled: { addListener(fn) { callbacks.installed = fn; } },
    onStartup: { addListener(fn) { callbacks.startup = fn; } },
    getURL: p => p,
    async openOptionsPage() {}
  },
  notifications: {
    onClicked: { addListener() {} },
    onButtonClicked: { addListener() {} },
    async create() {},
    async clear() {}
  }
};
const ctx = { chrome: stub, Date, console };
runInNewContext(background + "\nglobalThis.test = { schedule, isDue, isDone };", ctx);
await ctx.test.schedule();
assert.equal(alarms.has("midnight"), true);
assert.equal(badge.at(-1), "1");
await stub.alarms.create("snooze:alpha", { when: Date.now() + 600000 });
await ctx.test.schedule();
assert.equal(alarms.has("snooze:alpha"), true, "Rescheduling must preserve snooze alarms");
tasks[0].completed = [new Date().getFullYear() + "-" + String(new Date().getMonth() + 1).padStart(2,"0") + "-" + String(new Date().getDate()).padStart(2,"0")];
await ctx.test.schedule();
assert.equal(badge.at(-1), "");
tasks[0].completed = [];
tasks[0].deletedAt = Date.now();
await ctx.test.schedule();
assert.equal(badge.at(-1), "", "Trash must not contribute to badge or reminders");
tasks[0].deletedAt = undefined;
tasks[0].kind = "shortcut";
await ctx.test.schedule();
assert.equal(badge.at(-1), "", "Shortcuts must not contribute to badge or reminders");
console.log("DailyDock smoke tests passed: recurrence, completed state, safe URLs, UI markup, import, badge, snooze.");
