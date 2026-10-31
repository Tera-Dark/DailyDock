export type Repeat = "daily" | "weekly" | "once";
export interface Task {
  id: string;
  title: string;
  category: string;
  repeat: Repeat;
  weekdays: number[];
  date: string;
  time: string;
  url: string;
  remind: boolean;
  completed: string[];
  createdAt: number;
  noteOrder?: number;
  deletedAt?: number;
  kind?: "shortcut";
  pinned?: boolean;
  visitCount?: number;
  lastOpenedAt?: number;
  visitHours?: number[];
}
export interface Settings {
  theme: "system" | "light" | "dark";
  sidebarCollapsed?: boolean;
  starterSitesAdded?: boolean;
  suggestionsEnabled?: boolean;
}
export const TASKS_KEY = "dailydock.tasks",
  SETTINGS_KEY = "dailydock.settings",
  LOG_KEY = "dailydock.reminderLog";
export const pad = (v: number) => String(v).padStart(2, "0");
export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function due(t: Task, d = new Date()) {
  return (
    t.repeat === "daily" ||
    (t.repeat === "weekly"
      ? t.weekdays.includes(d.getDay())
      : !t.date || t.date <= dayKey(d))
  );
}
/** Calendar shows dated one-off tasks on their scheduled day, not every overdue day. */
export function scheduledOn(t: Task, d: Date, today = new Date()) {
  if (t.deletedAt || t.kind === "shortcut") return false;
  if (
    t.repeat !== "once" &&
    Number.isFinite(t.createdAt) &&
    dayKey(d) < dayKey(new Date(t.createdAt)) &&
    !t.completed.includes(dayKey(d))
  )
    return false;
  if (t.repeat === "daily") return true;
  if (t.repeat === "weekly") return t.weekdays.includes(d.getDay());
  return t.date ? t.date === dayKey(d) : dayKey(d) === dayKey(today);
}
export function reminderDue(t: Task, d = new Date()) {
  return due(t, d) && !(t.repeat === "once" && t.date && t.date !== dayKey(d));
}
export function done(t: Task, d = new Date()) {
  return t.completed.includes(t.repeat === "once" ? "__once__" : dayKey(d));
}
export function safeUrl(raw: string) {
  try {
    const u = new URL(raw);
    return ["http:", "https:"].includes(u.protocol) ? u.href : "";
  } catch {
    return "";
  }
}
export function id() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `task-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}
export function quickParse(raw: string) {
  const text = raw.trim();
  if (!text) throw Error("写点什么再贴上吧。");
  const m = text.match(/https?:\/\/[^\s]+/i);
  const bare =
    !m && /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#]\S*)?$/i.test(text)
      ? text
      : "";
  if (!m && !bare && /\b[a-z][a-z0-9+.-]*:\/\//i.test(text))
    throw Error("网址只支持 http 或 https。");
  const url = m ? safeUrl(m[0]) : bare ? safeUrl("https://" + bare) : "";
  if ((m || bare) && !url) throw Error("网址格式不正确。");
  const title = url
    ? (m ? text.replace(m[0], "").trim() : "") ||
      new URL(url).hostname.replace(/^www\./, "")
    : text;
  if (title.length > 160) throw Error("名称不能超过 160 个字。");
  return { title, url };
}
export function newTask(title: string, url = "", category = ""): Task {
  return {
    id: id(),
    title,
    url,
    category,
    repeat: url ? "daily" : "once",
    weekdays: [],
    date: "",
    time: "",
    remind: false,
    completed: [],
    createdAt: Date.now(),
  };
}
export function noteSort(a: Task, b: Task) {
  return (
    (a.noteOrder ?? a.createdAt) - (b.noteOrder ?? b.createdAt) ||
    a.createdAt - b.createdAt
  );
}
export function parseBackup(payload: unknown): Task[] {
  const p = payload as { tasks?: unknown };
  if (!p || !Array.isArray(p.tasks) || p.tasks.length > 3000)
    throw Error("备份格式不正确或任务数量过多。");
  const ids = new Set<string>();
  return p.tasks.map((v: unknown) => {
    const x = v as Partial<Task>;
    if (!x || typeof x.title !== "string" || !x.title.trim())
      throw Error("发现无效任务。");
    if (x.kind === "shortcut" && !safeUrl(x.url || ""))
      throw Error("备份中有无效的常用入口网址。");
    let taskId = String(x.id || "").slice(0, 100);
    if (!taskId || ids.has(taskId)) taskId = id();
    ids.add(taskId);
    const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(x.time || "") ? x.time! : "";
    return {
      id: taskId,
      title: x.title.slice(0, 160),
      category: String(x.category || "").slice(0, 40),
      repeat: (["daily", "weekly", "once"].includes(x.repeat || "")
        ? x.repeat
        : "daily") as Repeat,
      weekdays: Array.isArray(x.weekdays)
        ? [
            ...new Set(
              x.weekdays.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
            ),
          ]
        : [],
      date: /^\d{4}-\d{2}-\d{2}$/.test(x.date || "") ? x.date! : "",
      time,
      url: safeUrl(x.url || ""),
      remind: !!x.remind && !!time,
      completed: Array.isArray(x.completed)
        ? [
            ...new Set(
              x.completed.filter(
                (d) =>
                  d === "__once__" ||
                  (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)),
              ),
            ),
          ]
        : [],
      createdAt: Number.isFinite(x.createdAt) ? x.createdAt! : Date.now(),
      ...(Number.isFinite(x.noteOrder) ? { noteOrder: x.noteOrder } : {}),
      ...(Number.isFinite(x.deletedAt) && x.deletedAt! > 0
        ? { deletedAt: x.deletedAt }
        : {}),
      ...(x.kind === "shortcut"
        ? {
            kind: "shortcut" as const,
            pinned: !!x.pinned,
            visitCount:
              Number.isFinite(x.visitCount) && x.visitCount! >= 0
                ? x.visitCount
                : 0,
            lastOpenedAt:
              Number.isFinite(x.lastOpenedAt) && x.lastOpenedAt! > 0
                ? x.lastOpenedAt
                : undefined,
            visitHours:
              Array.isArray(x.visitHours) && x.visitHours.length === 8
                ? x.visitHours.map((n) =>
                    Number.isSafeInteger(n) && n >= 0
                      ? Math.min(n, 1000000)
                      : 0,
                  )
                : undefined,
          }
        : {}),
    };
  });
}
export const starters = [
  ["Linux DO", "https://linux.do/", "社区"],
  ["昆仑 API", "https://api.kunyou.asia/dashboard", "API 服务"],
  ["AnyRouter", "https://anyrouter.top/console", "API 服务"],
  ["X666", "https://x666.me/", "社区"],
];

/** Suggestions use only explicit launches from DailyDock. Eight three-hour buckets are local. */
export function shortcutScore(t: Task, now = new Date()) {
  const count = Math.max(0, Math.min(t.visitCount || 0, 1000000));
  const days = t.lastOpenedAt
    ? Math.max(0, (now.getTime() - t.lastOpenedAt) / 86400000)
    : 365;
  const bucket = Math.floor(now.getHours() / 3);
  const hour = Array.isArray(t.visitHours)
    ? Math.max(0, Math.min(t.visitHours[bucket] || 0, 1000000))
    : 0;
  return (
    (Math.log2(count + 1) * 2) / (1 + days / 14) + Math.log2(hour + 1) * 1.5
  );
}
export function suggestedShortcuts(items: Task[], now = new Date(), limit = 4) {
  return items
    .filter(
      (t) =>
        t.kind === "shortcut" &&
        !t.deletedAt &&
        (!!t.pinned || (t.visitCount || 0) > 0),
    )
    .slice()
    .sort(
      (a, b) =>
        Number(!!b.pinned) - Number(!!a.pinned) ||
        shortcutScore(b, now) - shortcutScore(a, now) ||
        (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0) ||
        a.createdAt - b.createdAt,
    )
    .slice(0, limit);
}
export function guessShortcutCategory(url: string, items: Task[]) {
  try {
    const hostname = new URL(url).hostname;
    return (
      items
        .filter((t) => !t.deletedAt && t.category && t.url)
        .find((t) => {
          try {
            return new URL(t.url).hostname === hostname;
          } catch {
            return false;
          }
        })?.category || ""
    );
  } catch {
    return "";
  }
}
