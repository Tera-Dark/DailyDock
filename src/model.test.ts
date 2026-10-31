import { describe, it, expect } from "vitest";
import {
  due,
  done,
  scheduledOn,
  reminderDue,
  quickParse,
  parseBackup,
  noteSort,
  suggestedShortcuts,
  guessShortcutCategory,
  type Task,
} from "./model";
const base: Task = {
  id: "a",
  title: "测试",
  category: "",
  repeat: "daily",
  weekdays: [],
  date: "",
  time: "",
  url: "",
  remind: false,
  completed: [],
  createdAt: 1,
};
describe("任务与备份", () => {
  it("支持每日、指定星期、单次和完成状态", () => {
    const d = new Date(2026, 9, 30, 12);
    expect(due(base, d)).toBe(true);
    expect(due({ ...base, repeat: "weekly", weekdays: [5] }, d)).toBe(true);
    expect(due({ ...base, repeat: "weekly", weekdays: [1] }, d)).toBe(false);
    expect(due({ ...base, repeat: "once", date: "2026-11-01" }, d)).toBe(false);
    expect(done({ ...base, repeat: "once", completed: ["__once__"] }, d)).toBe(
      true,
    );
    expect(done({ ...base, completed: ["2026-10-30"] }, d)).toBe(true);
  });
  it("识别文字与网址并拒绝不安全协议", () => {
    expect(quickParse("喝水")).toEqual({ title: "喝水", url: "" });
    expect(quickParse("示例 https://example.com/path")).toEqual({
      title: "示例",
      url: "https://example.com/path",
    });
    expect(quickParse("example.com").url).toBe("https://example.com/");
    expect(() => quickParse("ftp://example.com")).toThrow();
  });
  it("导入保留历史、排序和回收站，且兼容旧字段", () => {
    const history = Array.from(
      { length: 500 },
      (_, i) =>
        `2025-${String(Math.floor(i / 31) + 1).padStart(2, "0")}-${String((i % 31) + 1).padStart(2, "0")}`,
    );
    const [t] = parseBackup({
      tasks: [
        { title: "旧任务", completed: history, noteOrder: 2, deletedAt: 100 },
      ],
    });
    expect(t.completed).toHaveLength(500);
    expect(t.noteOrder).toBe(2);
    expect(t.deletedAt).toBe(100);
    expect(t.repeat).toBe("daily");
    expect(() => parseBackup({ tasks: "bad" })).toThrow();
  });
  it("备份保留常用入口类型、置顶与使用记录", () => {
    const [entry] = parseBackup({
      tasks: [
        {
          id: "s",
          title: "工具",
          url: "https://example.com/",
          kind: "shortcut",
          pinned: true,
          visitCount: 3,
          lastOpenedAt: 123,
          deletedAt: 55,
        },
      ],
    });
    expect(entry.kind).toBe("shortcut");
    expect(entry.pinned).toBe(true);
    expect(entry.visitCount).toBe(3);
    expect(entry.lastOpenedAt).toBe(123);
    expect(entry.deletedAt).toBe(55);
    expect(() =>
      parseBackup({
        tasks: [
          { title: "坏入口", url: "javascript:alert(1)", kind: "shortcut" },
        ],
      }),
    ).toThrow();
  });
  it("本地推荐优先置顶，并依据近期与时段，不推荐未使用和回收站入口", () => {
    const now = new Date(2026, 9, 31, 9);
    const regular = {
      ...base,
      id: "a",
      url: "https://a.example/",
      kind: "shortcut" as const,
      visitCount: 2,
      lastOpenedAt: now.getTime(),
      visitHours: [0, 0, 0, 2, 0, 0, 0, 0],
    };
    const pin = { ...regular, id: "p", visitCount: 0, pinned: true };
    const unused = { ...regular, id: "u", visitCount: 0, visitHours: [] };
    const deleted = { ...regular, id: "d", deletedAt: 1 };
    expect(
      suggestedShortcuts([regular, unused, deleted, pin], now).map((t) => t.id),
    ).toEqual(["p", "a"]);
  });
  it("同域名沿用已有分类，不读取外部信息", () => {
    const previous = {
      ...base,
      url: "https://example.com/a",
      category: "工具",
    };
    expect(guessShortcutCategory("https://example.com/b", [previous])).toBe(
      "工具",
    );
    expect(guessShortcutCategory("https://other.com/", [previous])).toBe("");
  });
  it("备份保留本地时段计数并限制异常值", () => {
    const [t] = parseBackup({
      tasks: [
        {
          title: "入口",
          url: "https://example.com",
          kind: "shortcut",
          visitHours: [1, 2, 3, 4, 5, 6, 7, 8],
        },
      ],
    });
    expect(t.visitHours).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const [bad] = parseBackup({
      tasks: [
        {
          title: "入口",
          url: "https://example.com",
          kind: "shortcut",
          visitHours: [-1, 2],
        },
      ],
    });
    expect(bad.visitHours).toBeUndefined();
  });
  it("日历区分指定日期、周期和无日期事项", () => {
    const today = new Date(2026, 9, 30),
      next = new Date(2026, 9, 31);
    const once = { ...base, repeat: "once" as const, date: "2026-10-31" };
    expect(scheduledOn(once, today, today)).toBe(false);
    expect(scheduledOn(once, next, today)).toBe(true);
    expect(scheduledOn({ ...once, date: "" }, today, today)).toBe(true);
    expect(scheduledOn({ ...once, date: "" }, next, today)).toBe(false);
    expect(
      scheduledOn({ ...base, repeat: "weekly", weekdays: [6] }, next, today),
    ).toBe(true);
    expect(scheduledOn({ ...base, deletedAt: 1 }, today, today)).toBe(false);
    expect(
      scheduledOn({ ...base, createdAt: next.getTime() }, today, today),
    ).toBe(false);
    expect(
      scheduledOn(
        { ...base, createdAt: next.getTime(), completed: ["2026-10-30"] },
        today,
        today,
      ),
    ).toBe(true);
  });
  it("无日期事项完成后仍可在当天日历撤销完成",()=>{const date=new Date(2026,9,31);expect(scheduledOn({...base,repeat:'once',date:'',completed:['__once__']},date,date)).toBe(true)});
  it("指定日期的单次提醒不会在逾期后每天重复触发", () => {
    const task = { ...base, repeat: "once" as const, date: "2026-10-30" };
    expect(reminderDue(task, new Date(2026, 9, 30))).toBe(true);
    expect(reminderDue(task, new Date(2026, 9, 31))).toBe(false);
  });
  it("排序优先按保存位置", () => {
    expect(
      [
        { ...base, id: "b", noteOrder: 1 },
        { ...base, id: "a", noteOrder: 0 },
      ]
        .sort(noteSort)
        .map((x) => x.id),
    ).toEqual(["a", "b"]);
  });
});
