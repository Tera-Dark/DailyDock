const KEY = "dailydock.tasks";
const pad = n => String(n).padStart(2, "0");
const dayKey = (date = new Date()) => [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join("-");
function isDue(task, today = new Date()) {
  if (task.repeat === "daily") return true;
  if (task.repeat === "weekly") return Array.isArray(task.weekdays) && task.weekdays.includes(today.getDay());
  return !task.date || task.date <= dayKey(today);
}
function isDone(task, today = new Date()) {
  return (task.completed || []).includes(task.repeat === "once" ? "__once__" : dayKey(today));
}
async function readTasks() {
  const data = await chrome.storage.local.get(KEY);
  return Array.isArray(data[KEY]) ? data[KEY] : [];
}
async function refreshBadge(tasks) {
  const incomplete = tasks.filter(task => isDue(task) && !isDone(task)).length;
  await chrome.action.setBadgeText({ text: incomplete ? (incomplete > 99 ? "99+" : String(incomplete)) : "" });
  await chrome.action.setBadgeBackgroundColor({ color: "#303030" });
}
async function schedule() {
  const tasks = await readTasks();
  const existing = await chrome.alarms.getAll();
  const snoozes = existing.filter(a => a.name.startsWith("snooze:") && a.scheduledTime > Date.now());
  await chrome.alarms.clearAll();
  for (const alarm of snoozes) await chrome.alarms.create(alarm.name, { when: alarm.scheduledTime });
  const nextDay = new Date();
  nextDay.setHours(24, 0, 5, 0);
  await chrome.alarms.create("midnight", { when: nextDay.getTime() });
  await refreshBadge(tasks);
  const now = new Date();
  for (const task of tasks) {
    if (!task.remind || !task.time || !isDue(task) || isDone(task)) continue;
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(task.time);
    if (!match) continue;
    const target = new Date();
    target.setHours(Number(match[1]), Number(match[2]), 0, 0);
    // A missed reminder is not silently re-sent on every browser startup.
    if (target.getTime() > now.getTime()) {
      await chrome.alarms.create("task:" + task.id, { when: target.getTime() });
    }
  }
}
async function remind(id) {
  const task = (await readTasks()).find(t => t.id === id);
  if (!task || !task.remind || !isDue(task) || isDone(task)) return;
  await chrome.notifications.create("dd:" + id, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icon.png"),
    title: "DailyDock · 待办提醒",
    message: task.title,
    buttons: [{ title: "10 分钟后提醒" }, { title: "打开管理页" }],
    priority: 1
  });
}
chrome.runtime.onInstalled.addListener(() => { void schedule(); });
chrome.runtime.onStartup.addListener(() => { void schedule(); });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[KEY]) void schedule();
});
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === "midnight") return void schedule();
  if (alarm.name.startsWith("task:")) return void remind(alarm.name.slice(5));
  if (alarm.name.startsWith("snooze:")) return void remind(alarm.name.slice(7));
});
chrome.notifications.onClicked.addListener(id => {
  if (id.startsWith("dd:")) void chrome.runtime.openOptionsPage();
});
chrome.notifications.onButtonClicked.addListener((id, buttonIndex) => {
  if (!id.startsWith("dd:")) return;
  if (buttonIndex === 0) {
    void chrome.alarms.create("snooze:" + id.slice(3), { when: Date.now() + 10 * 60_000 });
    void chrome.notifications.clear(id);
  } else {
    void chrome.runtime.openOptionsPage();
  }
});
