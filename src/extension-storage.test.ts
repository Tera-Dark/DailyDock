import { describe, it, expect, vi } from "vitest";
const state: Record<string, unknown> = {
  "dailydock.settings": { starterSitesAdded: true },
  "dailydock.tasks": [
    {
      id: "x",
      title: "扩展旧任务",
      repeat: "daily",
      url: "",
      category: "",
      weekdays: [],
      date: "",
      time: "",
      remind: false,
      completed: [],
      createdAt: 1,
    },
  ],
};
const listeners = new Set<(...args: unknown[]) => void>();
vi.stubGlobal("navigator", { locks: undefined });
vi.stubGlobal("chrome", {
  runtime: { id: "extension-test" },
  storage: {
    local: {
      get: async (keys: string[]) =>
        Object.fromEntries(
          keys.filter((k) => k in state).map((k) => [k, state[k]]),
        ),
      set: async (v: Record<string, unknown>) => Object.assign(state, v),
    },
    onChanged: {
      addListener: (f: (...args: unknown[]) => void) => listeners.add(f),
      removeListener: (f: (...args: unknown[]) => void) => listeners.delete(f),
    },
  },
});
const { extensionMode, load, updateTasks, storage } = await import("./storage");
describe("扩展存储适配器", () => {
  it("继续使用 chrome.storage.local 和原数据键", async () => {
    expect(extensionMode).toBe(true);
    expect((await load()).tasks[0].title).toBe("扩展旧任务");
    await updateTasks((items) => items.map((t) => ({ ...t, deletedAt: 42 })));
    expect(
      (state["dailydock.tasks"] as { deletedAt: number }[])[0].deletedAt,
    ).toBe(42);
  });
  it("监听和释放扩展存储变化", () => {
    const listener = vi.fn();
    const off = storage.subscribe(listener);
    for (const fn of listeners) fn({ "dailydock.tasks": {} }, "local");
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    expect(listeners.size).toBe(0);
  });
});
