import {
  TASKS_KEY,
  SETTINGS_KEY,
  type Task,
  type Settings,
  starters,
  newTask,
  safeUrl,
} from "./model";
export const extensionMode =
  !!globalThis.chrome?.runtime?.id && !!globalThis.chrome?.storage?.local;
type Values = Record<string, unknown>;
export const storage = {
  async get(keys: string[]): Promise<Values> {
    if (extensionMode) return await chrome.storage.local.get(keys);
    const result: Values = {};
    for (const key of keys) {
      const v = localStorage.getItem(key);
      if (v !== null) {
        try {
          result[key] = JSON.parse(v);
        } catch {
          if (key !== SETTINGS_KEY)
            throw Error("本地数据无法解析，请先从备份恢复。");
        }
      }
    }
    return result;
  },
  async set(data: Values) {
    if (extensionMode) {
      await chrome.storage.local.set(data);
      return;
    }
    for (const [key, val] of Object.entries(data))
      localStorage.setItem(key, JSON.stringify(val));
  },
  subscribe(fn: () => void) {
    if (extensionMode) {
      const listener = (
        c: Record<string, chrome.storage.StorageChange>,
        area: string,
      ) => {
        if (area === "local" && (c[TASKS_KEY] || c[SETTINGS_KEY])) fn();
      };
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    }
    const listener = (e: StorageEvent) => {
      if (!e.key || e.key === TASKS_KEY || e.key === SETTINGS_KEY) fn();
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  },
};
let queue = Promise.resolve();
export function locked<T>(name: string, fn: () => Promise<T>): Promise<T> {
  if (navigator.locks)
    return navigator.locks.request(name, fn) as unknown as Promise<T>;
  const result = queue.catch(() => {}).then(fn);
  queue = result.then(
    () => {},
    () => {},
  );
  return result;
}
function asTasks(v: unknown): Task[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) throw Error("任务数据格式异常，请从备份恢复。");
  return v.map((entry: unknown) => {
    if (!entry || typeof entry !== "object")
      throw Error("任务数据格式异常，请从备份恢复。");
    const t = entry as Partial<Task>;
    if (typeof t.id !== "string" || typeof t.title !== "string")
      throw Error("任务数据不完整，请从备份恢复。");
    return {
      ...t,
      id: t.id,
      title: t.title,
      category: typeof t.category === "string" ? t.category : "",
      repeat: (["daily", "weekly", "once"].includes(t.repeat || "")
        ? t.repeat
        : "daily") as Task["repeat"],
      weekdays: Array.isArray(t.weekdays) ? t.weekdays : [],
      date: typeof t.date === "string" ? t.date : "",
      time: typeof t.time === "string" ? t.time : "",
      url: typeof t.url === "string" ? t.url : "",
      remind: !!t.remind,
      completed: Array.isArray(t.completed) ? t.completed : [],
      createdAt: Number.isFinite(t.createdAt) ? t.createdAt! : 0,
    };
  });
}
export async function load() {
  const data = await storage.get([TASKS_KEY, SETTINGS_KEY]);
  return {
    tasks: asTasks(data[TASKS_KEY]),
    settings: {
      theme: "system",
      ...((data[SETTINGS_KEY] as object) || {}),
    } as Settings,
  };
}
export async function initialize() {
  await locked("dailydock.tasks", async () => {
    const { tasks, settings } = await load();
    if (settings.starterSitesAdded) return;
    const urls = new Set(
      tasks.filter((t) => t.kind !== "shortcut").map((t) => safeUrl(t.url)),
    );
    const additions = starters
      .filter(([, url]) => !urls.has(safeUrl(url)))
      .map(([title, url, category], i) => ({
        ...newTask(title, url, category),
        createdAt: Date.now() + i,
      }));
    await storage.set({
      [TASKS_KEY]: [...tasks, ...additions],
      [SETTINGS_KEY]: { ...settings, starterSitesAdded: true },
    });
  });
}
export async function updateTasks(change: (current: Task[]) => Task[]) {
  return locked("dailydock.tasks", async () => {
    const { tasks } = await load();
    const next = change(tasks);
    await storage.set({ [TASKS_KEY]: next });
    return next;
  });
}
export async function updateSettings(change: Partial<Settings>) {
  return locked("dailydock.settings", async () => {
    const { settings } = await load();
    const next = { ...settings, ...change };
    await storage.set({ [SETTINGS_KEY]: next });
    return next;
  });
}
