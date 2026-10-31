import * as Dialog from "@radix-ui/react-dialog";
import { X, Repeat2, Bell, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { safeUrl, dayKey, type Task, type Repeat } from "../model";
import { extensionMode } from "../storage";
interface Props {
  task: Task | null;
  isNew: boolean;
  open: boolean;
  onClose: () => void;
  onSave: (task: Task, original: Task | null) => Promise<boolean>;
}
export function Editor({ task, isNew, open, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<Task | null>(task),
    [extra, setExtra] = useState(false),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) {
      setDraft(task ? structuredClone(task) : null);
      setExtra(!!(task?.url || task?.category));
      setError("");
    }
  }, [open, task]);
  if (!draft) return null;
  const set = <K extends keyof Task>(key: K, value: Task[K]) =>
    setDraft((t) => (t ? { ...t, [key]: value } : t));
  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;
    const title = draft.title.trim(),
      url = draft.url.trim();
    const data = new FormData(e.currentTarget);
    const time = String(data.get("time") || "");
    const date = draft.repeat === "once" ? String(data.get("date") || "") : "";
    if (!title) return setError("请输入任务名称。");
    if (title.length > 160) return setError("事项名称不能超过 160 个字。");
    if (isNew && task?.url && !url) {
      setExtra(true);
      return setError("请输入网站地址。");
    }
    if (url && !safeUrl(url)) {
      setExtra(true);
      return setError("网站地址必须以 http:// 或 https:// 开头。");
    }
    if (draft.repeat === "weekly" && !draft.weekdays.length)
      return setError("每周任务至少选择一天。");
    if (draft.remind && draft.repeat === "once" && !date)
      return setError("请为单次提醒选择日期。");
    if (draft.remind && !time) return setError("开启提醒后，请设置时间。");
    const changedRepeat =
      task?.repeat !== draft.repeat ||
      (draft.repeat === "once" && task?.date !== date);
    const updated = {
      ...draft,
      title,
      time,
      url: url ? safeUrl(url) : "",
      category: draft.category.trim(),
      weekdays: draft.repeat === "weekly" ? draft.weekdays : [],
      date: draft.repeat === "once" ? date : "",
      completed: changedRepeat ? [] : draft.completed,
    };
    setSaving(true);
    try {
      if (await onSave(updated, isNew ? null : task)) onClose();
      else setError("任务已在其他页面修改，或保存失败。请关闭后重新打开。");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="editor-modal">
          <header className="editor-head">
            <div>
              <Dialog.Title>
                {isNew ? "新建事项" : draft.url ? "编辑网站" : "编辑便签"}
              </Dialog.Title>
              <Dialog.Description>
                安排日期和提醒，其他细节按需填写。
              </Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="关闭编辑窗口">
              <X size={19} />
            </Dialog.Close>
          </header>
          <form onSubmit={save}>
            <div className="editor-fields">
              <label className="field">
                <span>事项名称</span>
                <input
                  autoFocus
                  maxLength={160}
                  value={draft.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="需要做什么？"
                  required
                />
              </label>
              <div className="field-grid">
                <label className="field">
                  <span>重复</span>
                  <select
                    value={draft.repeat}
                    onChange={(e) => set("repeat", e.target.value as Repeat)}
                  >
                    <option value="once">不重复</option>
                    <option value="daily">每天</option>
                    <option value="weekly">每周指定日期</option>
                  </select>
                </label>
                <label className="field">
                  <span>时间（可选）</span>
                  <input
                    aria-label="时间（可选）"
                    name="time"
                    type="time"
                    value={draft.time}
                    onChange={(e) => set("time", e.target.value)}
                    onInput={(e) => set("time", e.currentTarget.value)}
                  />
                </label>
              </div>
              {draft.repeat === "once" && (
                <div className="date-field">
                  <label className="field">
                    <span>日期（可选）</span>
                    <input
                      name="date"
                      type="date"
                      value={draft.date}
                      onChange={(e) => set("date", e.target.value)}
                      onInput={(e) => set("date", e.currentTarget.value)}
                    />
                  </label>
                  <div className="date-presets">
                    {[0, 1].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className="chip"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + n);
                          set("date", dayKey(d));
                        }}
                      >
                        {n ? "明天" : "今天"}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="chip"
                      onClick={() => set("date", "")}
                    >
                      无日期
                    </button>
                  </div>
                </div>
              )}
              {draft.repeat === "weekly" && (
                <fieldset className="week-field">
                  <legend>重复日期</legend>
                  <div className="weekdays">
                    {["日", "一", "二", "三", "四", "五", "六"].map((x, i) => (
                      <label key={x}>
                        <input
                          type="checkbox"
                          checked={draft.weekdays.includes(i)}
                          onChange={(e) =>
                            set(
                              "weekdays",
                              e.target.checked
                                ? [...draft.weekdays, i]
                                : draft.weekdays.filter((n) => n !== i),
                            )
                          }
                        />
                        周{x}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <section className="editor-group">
                <label className="reminder-switch">
                  <Bell size={18} />
                  <span>
                    <b>到点提醒</b>
                    <small>
                      {extensionMode
                        ? "浏览器运行时，通过系统通知提醒"
                        : "页面保持打开时提醒"}
                    </small>
                  </span>
                  <input
                    type="checkbox"
                    checked={draft.remind}
                    onChange={(e) => {
                      setDraft((t) =>
                        t
                          ? {
                              ...t,
                              remind: e.target.checked,
                              date:
                                e.target.checked &&
                                t.repeat === "once" &&
                                !t.date
                                  ? dayKey()
                                  : t.date,
                            }
                          : t,
                      );
                    }}
                  />
                </label>
                {draft.remind && !draft.time && (
                  <p className="field-hint">请在上方选择时间。</p>
                )}
              </section>
              <section className="editor-group">
                <button
                  type="button"
                  className="extra-toggle"
                  aria-expanded={extra}
                  onClick={() => setExtra(!extra)}
                >
                  更多选项 <small>分类和网址</small>
                  <ChevronDown size={16} className={extra ? "flipped" : ""} />
                </button>
                {extra && (
                  <div className="extra-fields">
                    <label className="field">
                      <span>分类</span>
                      <input
                        value={draft.category}
                        maxLength={40}
                        onChange={(e) => set("category", e.target.value)}
                        placeholder="例如：工作、生活"
                      />
                    </label>
                    <label className="field">
                      <span>网址</span>
                      <input
                        type="url"
                        value={draft.url}
                        onChange={(e) => set("url", e.target.value)}
                        placeholder="https://example.com"
                      />
                      <small>打开网站后，需要手动标记完成。</small>
                    </label>
                  </div>
                )}
              </section>
              {error && (
                <div role="alert" className="form-error">
                  {error}
                </div>
              )}
            </div>
            <footer className="editor-footer">
              <small>仅保存在本机</small>
              <button type="button" className="button" onClick={onClose}>
                取消
              </button>
              <button disabled={saving} className="button primary">
                {saving ? "保存中…" : "保存"}
              </button>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
