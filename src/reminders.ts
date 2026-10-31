import {
  LOG_KEY,
  TASKS_KEY,
  type Task,
  dayKey,
  reminderDue,
  done,
} from "./model";
import { storage, locked, extensionMode } from "./storage";
let ctx: AudioContext | null = null;
export async function unlockAudio() {
  try {
    ctx ||= new AudioContext();
    if (ctx.state === "suspended") await ctx.resume();
    return ctx.state === "running";
  } catch {
    return false;
  }
}
export function playSound() {
  if (!ctx || ctx.state !== "running") return false;
  try {
    const a = ctx;
    const now = a.currentTime;
    [660, 830, 990].forEach((hz, i) => {
      const o = a.createOscillator(),
        g = a.createGain(),
        at = now + i * 0.19;
      o.type = "sine";
      o.frequency.value = hz;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.14, at + 0.025);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
      o.connect(g);
      g.connect(a.destination);
      o.start(at);
      o.stop(at + 0.3);
    });
    return true;
  } catch {
    return false;
  }
}
export function permissionLabel() {
  if (extensionMode) return "扩展使用系统通知，请检查系统通知设置。";
  if (!("Notification" in window)) return "当前浏览器不支持桌面通知。";
  return {
    granted: "桌面通知已允许。",
    denied: "通知已被阻止，请在浏览器网站设置中允许。",
    default: "桌面通知尚未授权。",
  }[Notification.permission];
}
export async function showReminder(title: string, test = false) {
  const sound = playSound();
  let desktop = false;
  try {
    if (extensionMode && test) {
      await chrome.notifications.create(`test:${Date.now()}`, {
        type: "basic",
        iconUrl: chrome.runtime.getURL("icon.png"),
        title: "DailyDock · 提醒测试",
        message: title,
      });
      desktop = true;
    } else if (
      !extensionMode &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      new Notification(test ? "DailyDock · 提醒测试" : "DailyDock · 到点提醒", {
        body: title,
        silent: sound,
        icon: "extension/icon.png",
      });
      desktop = true;
    }
  } catch (e) {
    console.error("通知失败", e);
  }
  return { sound, desktop };
}
export async function checkReminders(
  now: Date,
  last: Date,
  notice: (s: string) => void,
) {
  if (extensionMode) return;
  await locked("dailydock.reminders", async () => {
    const d = await storage.get([TASKS_KEY, LOG_KEY]);
    const list = Array.isArray(d[TASKS_KEY]) ? (d[TASKS_KEY] as Task[]) : [];
    const old = d[LOG_KEY] as { day?: string; keys?: string[] } | undefined;
    const today = dayKey(now),
      keys = old?.day === today && Array.isArray(old.keys) ? old.keys : [];
    const start = Math.max(last.getTime(), now.getTime() - 120_000);
    const matches = list.filter((t) => {
      if (
        t.deletedAt ||
        t.kind === "shortcut" ||
        !t.remind ||
        !t.time ||
        !reminderDue(t, now) ||
        done(t, now) ||
        keys.includes(`${t.id}|${t.time}`)
      )
        return false;
      const [h, m] = t.time.split(":").map(Number);
      if (!Number.isInteger(h) || !Number.isInteger(m) || h > 23 || m > 59)
        return false;
      const at = new Date(now);
      at.setHours(h, m, 0, 0);
      return at.getTime() <= now.getTime() && at.getTime() >= start;
    });
    if (!matches.length) return;
    await storage.set({
      [LOG_KEY]: {
        day: today,
        keys: [...keys, ...matches.map((t) => `${t.id}|${t.time}`)],
      },
    });
    for (const t of matches) {
      await showReminder(t.title);
      notice("到点提醒：" + t.title);
    }
  });
}
