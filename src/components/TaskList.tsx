import { Bell, ExternalLink, Trash2 } from "lucide-react";
import { type Task, done, dayKey } from "../model";
export function taskMeta(t: Task) {
  return [
    t.repeat === "once"
      ? t.date
      : t.repeat === "daily"
        ? "每天"
        : `每周${t.weekdays.map((n) => "日一二三四五六"[n]).join("、")}`,
    t.time,
    t.category,
  ]
    .filter(Boolean)
    .join(" · ");
}
export function TaskList({
  items,
  date = new Date(),
  onToggle,
  onEdit,
  onDelete,
  onOpen,
  compact = false,
  selected,
  onSelect,
}: {
  items: Task[];
  date?: Date;
  onToggle: (id: string, date: Date) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onOpen: (task: Task) => void;
  compact?: boolean;
  selected?: string[];
  onSelect?: (id: string) => void;
}) {
  return (
    <div className="task-list">
      {items.map((t) => {
        const complete = done(t, date),
          overdue =
            t.repeat === "once" && t.date && t.date < dayKey() && !complete;
        return (
          <article
            className={"task-row " + (complete ? "completed" : "")}
            key={t.id}
          >
            <input
              type="checkbox"
              checked={selected ? selected.includes(t.id) : complete}
              aria-label={
                selected
                  ? `选择：${t.title}`
                  : `${complete ? "取消完成" : "标记完成"}：${t.title}`
              }
              onChange={() =>
                selected ? onSelect?.(t.id) : onToggle(t.id, date)
              }
            />
            <button
              className="task-copy"
              onClick={() => onEdit(t)}
              aria-label={`编辑：${t.title}`}
            >
              <strong>{t.title}</strong>
              <small>
                {overdue && <span className="overdue">已逾期 · </span>}
                {taskMeta(t) || "随时处理"}
                {t.remind && (
                  <span className="reminder-label">
                    <Bell size={12} />
                    提醒已开
                  </span>
                )}
              </small>
            </button>
            <div className="row-actions">
              {t.url && (
                <button
                  className="icon-button"
                  title="打开网站"
                  aria-label={`打开网站：${t.title}`}
                  onClick={() => onOpen(t)}
                >
                  <ExternalLink size={16} />
                </button>
              )}
              {!compact && (
                <button
                  className="icon-button danger-text"
                  title="移到回收站"
                  aria-label={`移到回收站：${t.title}`}
                  onClick={() => onDelete(t.id)}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
