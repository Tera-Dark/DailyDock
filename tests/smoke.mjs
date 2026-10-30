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
    storage: {
      local: { async get() { return { "dailydock.tasks": tasks }; } },
      onChanged: { addListener() {} }
    }
  };
  const ctx = { document, chrome, crypto: { randomUUID: () => "test-id" },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    setTimeout, clearTimeout, URL, console };
  runInNewContext(app + "\nglobalThis.test = { isDue, isDone, safeUrl, renderPopup, renderOptions, parseBackup };", ctx);
  return { ...ctx.test, root };
}
const current = new Date(2026, 9, 30, 12, 0);
const popup = makeApp(true);
const options = makeApp(false);
assert.equal(popup.isDue({ repeat: "daily" }, current), true);
assert.equal(popup.isDue({ repeat: "weekly", weekdays: [5] }, current), true);
assert.equal(popup.isDue({ repeat: "weekly", weekdays: [2] }, current), false);
assert.equal(popup.isDue({ repeat: "once", date: "2026-11-01" }, current), false);
assert.equal(popup.isDue({ repeat: "once", date: "2026-10-29" }, current), true);
assert.equal(popup.isDone({ repeat: "once", completed: ["__once__"] }, current), true);
assert.equal(popup.isDone({ repeat: "daily", completed: ["2026-10-29"] }, current), false);
assert.equal(popup.safeUrl("javascript:alert(1)"), "");
assert.equal(popup.safeUrl("https://example.com").startsWith("https:"), true);
assert.match(popup.renderPopup(), /今日清单/);
assert.match(popup.renderPopup(), /quick-form/);
assert.match(options.renderOptions(), /task-dialog/);
assert.match(options.renderOptions(), /网站签到/);
const imported = options.parseBackup({ tasks: [{ title: "<script>x</script>", repeat: "daily", completed: [] }] });
assert.equal(imported.length, 1);
assert.equal(imported[0].title, "<script>x</script>");
assert.match(options.renderOptions(), /task-search/);

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
console.log("DailyDock smoke tests passed: recurrence, completed state, safe URLs, UI markup, import, badge, snooze.");
