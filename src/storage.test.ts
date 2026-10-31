import { beforeEach, describe, expect, it, vi } from "vitest";
import { TASKS_KEY, SETTINGS_KEY } from "./model";
const data = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => data.get(k) ?? null,
  setItem: (k: string, v: string) => {
    data.set(k, v);
  },
});
vi.stubGlobal("navigator", { locks: undefined });
import { initialize, load, updateTasks } from "./storage";
beforeEach(() => {
  data.clear();
});
describe("本地存储兼容", () => {
  it("读取旧记录并在初始化时避免重复网址", async () => {
    data.set(
      TASKS_KEY,
      JSON.stringify([
        { id: "old", title: "Linux DO", url: "https://linux.do/" },
      ]),
    );
    await initialize();
    const value = await load();
    expect(value.tasks).toHaveLength(4);
    expect(value.tasks.find((x) => x.id === "old")?.completed).toEqual([]);
    await initialize();
    expect((await load()).tasks).toHaveLength(4);
  });
  it("串行写入、保留回收站和顺序", async () => {
    data.set(SETTINGS_KEY, JSON.stringify({ starterSitesAdded: true }));
    data.set(
      TASKS_KEY,
      JSON.stringify([{ id: "a", title: "便签", noteOrder: 3, deletedAt: 10 }]),
    );
    await Promise.all([
      updateTasks((ts) => ts.map((t) => ({ ...t, title: "已改" }))),
      updateTasks((ts) => ts.map((t) => ({ ...t, category: "生活" }))),
    ]);
    const t = (await load()).tasks[0];
    expect(t.title).toBe("已改");
    expect(t.category).toBe("生活");
    expect(t.noteOrder).toBe(3);
    expect(t.deletedAt).toBe(10);
  });
  it("损坏数据不被自动覆盖", async () => {
    data.set(TASKS_KEY, "{oops");
    await expect(initialize()).rejects.toThrow();
    expect(data.get(TASKS_KEY)).toBe("{oops");
  });
});
