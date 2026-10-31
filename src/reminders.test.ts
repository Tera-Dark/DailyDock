import { beforeEach, describe, expect, it, vi } from "vitest";
import { TASKS_KEY, LOG_KEY } from "./model";
const store = new Map<string, string>();
const notifications: unknown[] = [];
class FakeNotification {
  static permission = "granted";
  constructor(
    public title: string,
    public options: unknown,
  ) {
    notifications.push({ title, options });
  }
}
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
});
vi.stubGlobal("navigator", { locks: undefined });
vi.stubGlobal("window", { Notification: FakeNotification });
vi.stubGlobal("Notification", FakeNotification);
import { checkReminders } from "./reminders";
beforeEach(() => {
  store.clear();
  notifications.length = 0;
});
describe("网页版提醒", () => {
  it("补偿短时延迟，并且重复检查只通知一次", async () => {
    store.set(
      TASKS_KEY,
      JSON.stringify([
        {
          id: "a",
          title: "签到",
          repeat: "daily",
          weekdays: [],
          date: "",
          time: "12:00",
          url: "",
          category: "",
          remind: true,
          completed: [],
          createdAt: 1,
        },
      ]),
    );
    const notices: string[] = [];
    const now = new Date(2026, 9, 30, 12, 1, 0),
      last = new Date(2026, 9, 30, 11, 59, 55);
    await checkReminders(now, last, (s) => notices.push(s));
    await checkReminders(now, last, (s) => notices.push(s));
    expect(notifications).toHaveLength(1);
    expect(notices).toHaveLength(1);
    expect(JSON.parse(store.get(LOG_KEY)!).keys).toContain("a|12:00");
  });
  it("已完成和回收站不提醒", async () => {
    store.set(
      TASKS_KEY,
      JSON.stringify([
        {
          id: "a",
          title: "签到",
          repeat: "daily",
          weekdays: [],
          date: "",
          time: "12:00",
          url: "",
          category: "",
          remind: true,
          completed: ["2026-10-30"],
          createdAt: 1,
        },
        {
          id: "c",
          title: "常用入口",
          kind: "shortcut",
          repeat: "daily",
          weekdays: [],
          date: "",
          time: "12:00",
          url: "https://example.com",
          category: "",
          remind: true,
          completed: [],
          createdAt: 1,
        },
        {
          id: "b",
          title: "删除",
          repeat: "daily",
          weekdays: [],
          date: "",
          time: "12:00",
          url: "",
          category: "",
          remind: true,
          deletedAt: 1,
          completed: [],
          createdAt: 1,
        },
      ]),
    );
    await checkReminders(
      new Date(2026, 9, 30, 12, 0, 30),
      new Date(2026, 9, 30, 12, 0, 0),
      () => {},
    );
    expect(notifications).toHaveLength(0);
  });
});

it("指定日期的提醒只在当天触发", async () => {
  store.set(
    TASKS_KEY,
    JSON.stringify([
      {
        id: "date",
        title: "预约",
        repeat: "once",
        weekdays: [],
        date: "2026-10-30",
        time: "12:00",
        url: "",
        category: "",
        remind: true,
        completed: [],
        createdAt: 1,
      },
    ]),
  );
  await checkReminders(
    new Date(2026, 9, 29, 12, 0, 30),
    new Date(2026, 9, 29, 12, 0, 0),
    () => {},
  );
  expect(notifications).toHaveLength(0);
  await checkReminders(
    new Date(2026, 9, 30, 12, 0, 30),
    new Date(2026, 9, 30, 12, 0, 0),
    () => {},
  );
  expect(notifications).toHaveLength(1);
  await checkReminders(
    new Date(2026, 9, 31, 12, 0, 30),
    new Date(2026, 9, 31, 12, 0, 0),
    () => {},
  );
  expect(notifications).toHaveLength(1);
});
