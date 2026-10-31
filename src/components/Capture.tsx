import { useState } from "react";
import { ArrowUp, CalendarDays } from "lucide-react";
export type CaptureKind = "task" | "shortcut" | "site";
export function Capture({
  onSave,
  onDetail,
  initial = "task",
}: {
  onSave: (raw: string, kind: CaptureKind) => Promise<boolean>;
  onDetail: (raw: string, kind: CaptureKind, onSaved: () => void) => void;
  initial?: CaptureKind;
}) {
  const [text, setText] = useState(""),
    [kind, setKind] = useState(initial),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <form
      className="capture"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy || !text.trim()) return;
        setBusy(true);
        try {
          if (await onSave(text, kind)) {
            setText("");
            setMessage("已添加");
          } else setMessage("未能添加，请检查内容或重复的网址。");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor="capture-input">快速记录</label>
      <input
        id="capture-input"
        placeholder={
          kind === "task"
            ? "记下一件事，按 Enter 保存"
            : kind === "site"
              ? "网站名称 + 网址，添加为每日签到"
              : "粘贴网址，或输入名称 + 网址"
        }
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setMessage("");
        }}
        maxLength={2048}
      />
      <div className="capture-footer">
        <div className="segmented" aria-label="记录类型">
          {(
            [
              ["task", "待办"],
              ["shortcut", "常用入口"],
              ["site", "网站签到"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={kind === key}
              onClick={() => {
                setKind(key);
                setMessage("");
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="capture-actions">
          <button
            type="button"
            className="icon-button"
            title="设置日期和提醒"
            aria-label="设置日期和提醒"
            onClick={() =>
              onDetail(text, kind, () => {
                setText("");
                setMessage("已添加");
              })
            }
          >
            <CalendarDays size={18} />
          </button>
          <button
            className="send-button"
            aria-label="保存记录"
            disabled={busy || !text.trim()}
          >
            {busy ? <span className="spinner" /> : <ArrowUp size={19} />}
          </button>
        </div>
      </div>
      {message && (
        <small role="status" className="capture-feedback">
          {message}
        </small>
      )}
    </form>
  );
}
