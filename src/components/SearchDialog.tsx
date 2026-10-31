import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { ArrowUpRight, Bookmark, Search, StickyNote, X } from "lucide-react";
import { type Task } from "../model";
export function SearchDialog({
  open,
  onClose,
  tasks,
  onChoose,
}: {
  open: boolean;
  onClose: () => void;
  tasks: Task[];
  onChoose: (task: Task) => void;
}) {
  const [query, setQuery] = useState("");
  const results = tasks
    .filter(
      (t) =>
        !t.deletedAt &&
        [t.title, t.category, t.url].some((x) =>
          x.toLowerCase().includes(query.trim().toLowerCase()),
        ),
    )
    .slice(0, 20);
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="search-modal">
          <Dialog.Title className="visually-hidden">搜索全部内容</Dialog.Title>
          <Dialog.Description className="visually-hidden">
            查找待办、便签、签到网站和常用入口。
          </Dialog.Description>
          <div className="global-search-field">
            <Search size={20} />
            <input
              autoFocus
              aria-label="搜索全部内容"
              placeholder="搜索任何内容…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Dialog.Close className="icon-button" aria-label="关闭搜索">
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className="search-results">
            {results.length ? (
              results.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    onChoose(t);
                    onClose();
                  }}
                >
                  {t.kind === "shortcut" ? (
                    <Bookmark size={18} />
                  ) : (
                    <StickyNote size={18} />
                  )}
                  <span>
                    <strong>{t.title}</strong>
                    <small>
                      {t.kind === "shortcut"
                        ? "常用入口"
                        : t.url
                          ? "网站签到"
                          : "待办 / 便签"}
                      {t.category ? " · " + t.category : ""}
                    </small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              ))
            ) : (
              <div className="empty-state">没有找到内容，试试其他关键词。</div>
            )}
          </div>
          <footer>
            打开入口 · 编辑事项 <kbd>Esc</kbd> 关闭
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
