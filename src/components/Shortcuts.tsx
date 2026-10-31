import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import {
  FolderPlus,
  Globe2,
  Pencil,
  Pin,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { safeUrl, shortcutScore, type Task } from "../model";
import { WebsiteIcon } from "./WebsiteIcon";
interface ShortcutProps {
  items: Task[];
  onAdd: (category: string) => void;
  onQuickAdd: (raw: string, category: string) => Promise<boolean>;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onPin: (id: string) => void;
  onOpen: (task: Task) => void;
}
function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
export function Shortcuts({
  items,
  onAdd,
  onQuickAdd,
  onEdit,
  onDelete,
  onPin,
  onOpen,
}: ShortcutProps) {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [mode, setMode] = useState<"smart" | "recent">("smart"),
    [quick, setQuick] = useState(""),
    [feedback, setFeedback] = useState(""),
    [busy, setBusy] = useState(false);
  const cats = [
    ...new Set(items.map((t) => t.category.trim() || "未分类")),
  ].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const visible = items
    .filter(
      (t) =>
        (!category || (t.category.trim() || "未分类") === category) &&
        [t.title, t.url, t.category].some((x) =>
          x.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
        ),
    )
    .sort(
      (a, b) =>
        Number(!!b.pinned) - Number(!!a.pinned) ||
        (mode === "recent"
          ? (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0)
          : shortcutScore(b) - shortcutScore(a) ||
            (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0)) ||
        a.createdAt - b.createdAt,
    );
  return (
    <section className="shortcuts-view">
      <form
        className="shortcut-quick"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || !quick.trim()) return;
          setBusy(true);
          try {
            if (
              await onQuickAdd(quick, category === "未分类" ? "" : category)
            ) {
              setQuick("");
              setQuery("");
              setFeedback("已收好");
            } else setFeedback("没有添加，请检查网址或是否已经收录。");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="visually-hidden" htmlFor="shortcut-quick-input">
          快速收录网址
        </label>
        <input
          id="shortcut-quick-input"
          value={quick}
          onChange={(e) => {
            setQuick(e.target.value);
            setFeedback("");
          }}
          placeholder="粘贴网址，或输入名称 + https://网址"
          maxLength={2048}
        />
        <button className="button primary" disabled={busy || !quick.trim()}>
          收下
        </button>
        <span className="quick-feedback" role="status">
          {feedback}
        </span>
      </form>
      <div className="shortcut-toolbar">
        <div className="search-bar">
          <Search size={17} />
          <input
            aria-label="搜索常用入口"
            placeholder="搜索名称、分类或网址"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="text-button" onClick={() => setQuery("")}>
              清除
            </button>
          )}
        </div>
        <div className="shortcut-sort" aria-label="排序方式">
          <button
            aria-pressed={mode === "smart"}
            onClick={() => setMode("smart")}
          >
            常用优先
          </button>
          <button
            aria-pressed={mode === "recent"}
            onClick={() => setMode("recent")}
          >
            最近打开
          </button>
        </div>
      </div>
      <div className="chips" role="group" aria-label="入口分类">
        {["", ...cats].map((c) => (
          <button
            key={c}
            className={"chip " + (category === c ? "active" : "")}
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {c || "全部"}
          </button>
        ))}
      </div>
      {visible.length ? (
        <div className="shortcut-grid">
          {visible.map((t) => (
            <article className="shortcut-card" key={t.id}>
              <button
                className="shortcut-open"
                aria-label={`打开入口：${t.title}`}
                onClick={() => onOpen(t)}
              >
                <WebsiteIcon url={t.url} title={t.title} />
                <strong>{t.title}</strong>
              </button>
              <div className="shortcut-actions">
                <button
                  className={"icon-button " + (t.pinned ? "pinned" : "")}
                  aria-label={`${t.pinned ? "取消置顶" : "置顶"}：${t.title}`}
                  title={t.pinned ? "取消置顶" : "置顶"}
                  onClick={() => onPin(t.id)}
                >
                  <Pin size={15} fill={t.pinned ? "currentColor" : "none"} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`编辑入口：${t.title}`}
                  onClick={() => onEdit(t)}
                >
                  <Pencil size={15} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`移入回收站：${t.title}`}
                  onClick={() => onDelete(t.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-note shortcut-empty">
          <FolderPlus size={22} />
          <div>
            <strong>
              {items.length ? "没有找到入口" : "这里还没有常用入口"}
            </strong>
            <p>
              {items.length
                ? "试试其他关键词或分类。"
                : "添加一个网址，之后就能从这里快速打开。"}
            </p>
          </div>
          {!items.length && (
            <button className="button" onClick={() => onAdd("")}>
              添加第一个入口
            </button>
          )}
        </div>
      )}
    </section>
  );
}
export function ShortcutDialog({
  task,
  isNew,
  categories,
  open,
  onClose,
  onSave,
}: {
  task: Task | null;
  isNew: boolean;
  categories: string[];
  open: boolean;
  onClose: () => void;
  onSave: (t: Task) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(task),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setDraft(task ? { ...task } : null);
      setError("");
    }
  }, [task, open]);
  if (!draft) return null;
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const raw = draft.url.trim();
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) && !/^https?:\/\//i.test(raw))
      return setError("只支持 http 或 https 网址。");
    const url = safeUrl(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!raw || !url) return setError("请输入有效的 http 或 https 网址。");
    const name = draft.title.trim() || host(url);
    if (!name) return setError("请输入入口名称。");
    setBusy(true);
    try {
      if (
        await onSave({
          ...draft,
          title: name.slice(0, 160),
          url,
          category: draft.category.trim().slice(0, 40),
        })
      )
        onClose();
      else setError("保存失败，或这个网址已在常用入口中。");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="editor-modal shortcut-dialog">
          <header className="editor-head">
            <div>
              <Dialog.Title>{isNew ? "添加常用入口" : "编辑入口"}</Dialog.Title>
              <Dialog.Description>
                网址、名称和分类，按你的习惯保存。
              </Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="关闭添加入口">
              <X size={19} />
            </Dialog.Close>
          </header>
          <form onSubmit={submit}>
            <div className="editor-fields">
              <label className="field">
                <span>网址</span>
                <input
                  autoFocus
                  type="text"
                  value={draft.url}
                  onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                  placeholder="example.com 或 https://example.com"
                />
                <small>只支持 http 和 https。</small>
              </label>
              <label className="field">
                <span>名称（可不填）</span>
                <input
                  type="text"
                  maxLength={160}
                  value={draft.title}
                  onChange={(e) =>
                    setDraft({ ...draft, title: e.target.value })
                  }
                  placeholder="留空时使用网站域名"
                />
              </label>
              <label className="field">
                <span>分类（可不填）</span>
                <input
                  type="text"
                  list="shortcut-categories"
                  maxLength={40}
                  value={draft.category}
                  onChange={(e) =>
                    setDraft({ ...draft, category: e.target.value })
                  }
                  placeholder="例如：工具、工作、阅读"
                />
                <datalist id="shortcut-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
              <label className="shortcut-pin-label">
                <input
                  type="checkbox"
                  checked={!!draft.pinned}
                  onChange={(e) =>
                    setDraft({ ...draft, pinned: e.target.checked })
                  }
                />
                置顶这个入口
              </label>
              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}
            </div>
            <footer className="editor-footer">
              <small>仅保存在当前浏览器</small>
              <button className="button" type="button" onClick={onClose}>
                取消
              </button>
              <button className="button primary" disabled={busy}>
                {busy ? "保存中…" : "保存入口"}
              </button>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
