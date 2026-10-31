import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { dayKey, done, scheduledOn, type Task } from "../model";
import { TaskList } from "./TaskList";

interface Props {
  tasks: Task[];
  onToggle: (id: string, date: Date) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onOpen: (task: Task) => void;
  onAdd: (date: Date) => void;
}
export function Calendar({
  tasks,
  onToggle,
  onEdit,
  onDelete,
  onOpen,
  onAdd,
}: Props) {
  const [selected, setSelected] = useState(() => new Date());
  const [kind, setKind] = useState<"all" | "notes">("all");
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const today = dayKey();
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(
      first.getFullYear(),
      first.getMonth(),
      1 - first.getDay(),
    );
    return Array.from(
      { length: 42 },
      (_, i) =>
        new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
    );
  }, [month]);
  const visible = kind === "notes" ? tasks.filter((t) => !t.url) : tasks;
  const selectedTasks = visible
    .filter((t) => scheduledOn(t, selected))
    .sort(
      (a, b) =>
        Number(done(a, selected)) - Number(done(b, selected)) ||
        (a.time || "99:99").localeCompare(b.time || "99:99") ||
        a.createdAt - b.createdAt,
    );
  const choose = (d: Date) => {
    setSelected(d);
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  };
  const moveMonth = (offset: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    setMonth(next);
    setSelected(
      new Date(
        next.getFullYear(),
        next.getMonth(),
        Math.min(selected.getDate(), last),
      ),
    );
  };
  return (
    <div className="calendar-layout">
      <section className="calendar-sheet" aria-label="月历">
        <div className="calendar-heading">
          <div>
            <h2>
              {month.getFullYear()} 年 {month.getMonth() + 1} 月
            </h2>
          </div>
          <div className="calendar-controls">
            <button
              className="icon-button"
              aria-label="上个月"
              onClick={() => moveMonth(-1)}
            >
              <ChevronLeft size={19} />
            </button>
            <button className="button" onClick={() => choose(new Date())}>
              今天
            </button>
            <button
              className="icon-button"
              aria-label="下个月"
              onClick={() => moveMonth(1)}
            >
              <ChevronRight size={19} />
            </button>
          </div>
        </div>
        <div className="segmented calendar-filter" aria-label="日历内容">
          <button aria-pressed={kind === "all"} onClick={() => setKind("all")}>
            全部事项
          </button>
          <button
            aria-pressed={kind === "notes"}
            onClick={() => setKind("notes")}
          >
            仅待办便签
          </button>
        </div>
        <div className="calendar-grid calendar-week" aria-hidden="true">
          {["日", "一", "二", "三", "四", "五", "六"].map((x) => (
            <span key={x}>{x}</span>
          ))}
        </div>
        <div className="calendar-grid">
          {cells.map((d) => {
            const key = dayKey(d),
              items = visible.filter((t) => scheduledOn(t, d)),
              pending = items.filter((t) => !done(t, d)).length;
            return (
              <button
                key={key}
                className={
                  "calendar-day " +
                  (d.getMonth() !== month.getMonth() ? "outside " : "") +
                  (key === today ? "is-today " : "") +
                  (key === dayKey(selected) ? "is-selected" : "")
                }
                aria-label={`${key}，${pending} 项待完成`}
                aria-pressed={key === dayKey(selected)}
                onClick={() => choose(d)}
              >
                <span>{d.getDate()}</span>
                {items.length > 0 && (
                  <small>{pending ? `${pending} 待办` : "已完成"}</small>
                )}
              </button>
            );
          })}
        </div>
        <p className="calendar-hint">
          无日期的待办只显示在今天；有日期的事项显示在指定日期。
        </p>
      </section>
      <section className="calendar-detail" aria-label="当日事项">
        <div className="calendar-detail-head">
          <div>
            <h2>
              {selected.getMonth() + 1} 月 {selected.getDate()} 日{" "}
              <small>
                周
                {["日", "一", "二", "三", "四", "五", "六"][selected.getDay()]}
              </small>
            </h2>
            <p>
              {selectedTasks.filter((t) => !done(t, selected)).length} 件待完成
            </p>
          </div>
          <button className="button primary" onClick={() => onAdd(selected)}>
            <Plus size={16} />
            添加
          </button>
        </div>
        <div className="calendar-items">
          {selectedTasks.length ? (
            <TaskList
              items={selectedTasks}
              date={selected}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
              onOpen={onOpen}
            />
          ) : (
            <div className="calendar-empty">
              这一天没有安排。
              <br />
              点击「添加」记录一件事。
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
