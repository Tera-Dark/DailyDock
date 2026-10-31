import code from "../extension/background.js?raw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { newTask } from "./model";

function background(tasks: ReturnType<typeof newTask>[]) {
  const alarms: { name: string; when: number }[] = [];
  const notifications: unknown[] = [];
  const listener = { addListener: vi.fn() };
  const chrome = {
    storage: {
      local: { get: async () => ({ "dailydock.tasks": tasks }) },
      onChanged: listener,
    },
    action: { setBadgeText: vi.fn(), setBadgeBackgroundColor: vi.fn() },
    alarms: {
      getAll: async () => [],
      clearAll: async () => {},
      create: async (name: string, { when }: { when: number }) => {
        alarms.push({ name, when });
      },
      onAlarm: listener,
    },
    notifications: {
      create: async (...args: unknown[]) => {
        notifications.push(args);
      },
      onClicked: listener,
      onButtonClicked: listener,
    },
    runtime: {
      getURL: (s: string) => s,
      onInstalled: listener,
      onStartup: listener,
      openOptionsPage: vi.fn(),
    },
  };
  const api = new Function(
    "chrome",
    "Date",
    code + ";return {schedule,remind};",
  )(chrome, Date) as {
    schedule: () => Promise<void>;
    remind: (id: string) => Promise<void>;
  };
  return { api, alarms, notifications };
}
afterEach(() => vi.useRealTimers());
describe("扩展后台提醒", () => {
  it("指定日期只在当天创建提醒，完成和删除后不创建", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 31, 9));
    const base = {
      ...newTask("预约"),
      date: "2026-10-31",
      time: "16:00",
      remind: true,
    };
    const bg = background([
      base,
      { ...base, id: "future", date: "2026-11-01" },
      { ...base, id: "past", date: "2026-10-30" },
      { ...base, id: "done", completed: ["__once__"] },
      { ...base, id: "deleted", deletedAt: 1 },
    ]);
    await bg.api.schedule();
    expect(
      bg.alarms.filter((a) => a.name.startsWith("task:")).map((a) => a.name),
    ).toEqual(["task:" + base.id]);
    await bg.api.remind("past");
    expect(bg.notifications).toHaveLength(0);
    await bg.api.remind(base.id);
    expect(bg.notifications).toHaveLength(1);
  });
});
