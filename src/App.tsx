import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutGrid,
  CalendarDays,
  List,
  StickyNote,
  Trash2,
  Settings as SettingsIcon,
  PanelLeft,
  Plus,
  Search,
  Bookmark,
  ArrowRight,
  Check,
  Menu,
  X,
  CircleCheck,
  ExternalLink,
  Pencil,
} from "lucide-react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as Dialog from "@radix-ui/react-dialog";
import {
  type Settings,
  type Task,
  dayKey,
  done,
  due,
  newTask,
  noteSort,
  parseBackup,
  quickParse,
  safeUrl,
  suggestedShortcuts,
  guessShortcutCategory,
} from "./model";
import {
  extensionMode,
  initialize,
  load,
  storage,
  updateSettings,
  updateTasks,
} from "./storage";
import { checkReminders, unlockAudio } from "./reminders";
import { Editor } from "./components/Editor";
import { Notes } from "./components/Notes";
import { WebsiteIcon } from "./components/WebsiteIcon";
import { Calendar } from "./components/Calendar";
import { SettingsPage } from "./components/SettingsPage";
import { Shortcuts, ShortcutDialog } from "./components/Shortcuts";
import { Capture, type CaptureKind } from "./components/Capture";
import { TaskList } from "./components/TaskList";
import { SearchDialog } from "./components/SearchDialog";
import { readCurrentTab } from "./current-tab";
const menus = [
  ["today", "今天", CircleCheck],
  ["calendar", "日历", CalendarDays],
  ["all", "全部任务", List],
  ["notes", "便利贴", StickyNote],
  ["sites", "网站签到", LayoutGrid],
  ["shortcuts", "常用入口", Bookmark],
  ["trash", "回收站", Trash2],
  ["settings", "设置", SettingsIcon],
] as const;
type View = (typeof menus)[number][0];
function openWebsite(t: Task) {
  const url = safeUrl(t.url);
  if (!url) return;
  if (extensionMode) void chrome.tabs.create({ url });
  else window.open(url, "_blank", "noopener,noreferrer");
}
export default function App() {
  const popup = document.body.classList.contains("popup");
  const [tasks, setTasks] = useState<Task[]>([]),
    [settings, setSettings] = useState<Settings>({ theme: "system" }),
    [view, setView] = useState<View>(() =>
      menus.some(([k]) => k === location.hash.slice(1))
        ? (location.hash.slice(1) as View)
        : "today",
    ),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [filter, setFilter] = useState("all"),
    [loading, setLoading] = useState(true),
    [fatal, setFatal] = useState(""),
    [toast, setToast] = useState("");
  const [editor, setEditor] = useState<{ task: Task; isNew: boolean } | null>(
    null,
  );
  const [, setCurrentDay] = useState(dayKey());
  const [shortcutEditor, setShortcutEditor] = useState<{
    task: Task;
    isNew: boolean;
  } | null>(null);
  const [purge, setPurge] = useState<Task | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const clearCapturedDraft = useRef<(() => void) | null>(null);
  const lastCheck = useRef(new Date(Math.floor(Date.now() / 60000) * 60000));
  const [searchOpen, setSearchOpen] = useState(false),
    [mobileOpen, setMobileOpen] = useState(false),
    [undo, setUndo] = useState<string[]>([]),
    [selecting, setSelecting] = useState(false),
    [selection, setSelection] = useState<string[]>([]);
  useEffect(() => {
    const changed = () => {
      const next = location.hash.slice(1);
      if (menus.some(([k]) => k === next)) {
        setView(next as View);
        setSearch("");
        setCategory("");
        setFilter("all");
      }
    };
    addEventListener("hashchange", changed);
    return () => removeEventListener("hashchange", changed);
  }, []);
  const notice = useCallback((m: string) => setToast(m), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  const refresh = useCallback(async () => {
    try {
      const d = await load();
      setTasks(d.tasks);
      setSettings(d.settings);
    } catch (e) {
      setFatal((e as Error).message);
    }
  }, []);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        await initialize();
        if (live) await refresh();
      } catch (e) {
        if (live) setFatal((e as Error).message);
      } finally {
        if (live) setLoading(false);
      }
    })();
    const stop = storage.subscribe(() => {
      void refresh();
    });
    return () => {
      live = false;
      stop();
    };
  }, [refresh]);
  useEffect(() => {
    const m = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        settings.theme === "dark" || (settings.theme === "system" && m.matches)
          ? "dark"
          : "light";
    };
    apply();
    m.addEventListener("change", apply);
    return () => m.removeEventListener("change", apply);
  }, [settings.theme]);
  useEffect(() => {
    const refreshDate = () =>
      setCurrentDay((previous) => {
        const today = dayKey();
        return previous === today ? previous : today;
      });
    const timer = setInterval(refreshDate, 60000);
    document.addEventListener("visibilitychange", refreshDate);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshDate);
    };
  }, []);
  useEffect(() => {
    if (extensionMode || loading) return;
    let active = true;
    const tick = async () => {
      const now = new Date(),
        previous = lastCheck.current;
      lastCheck.current = now;
      try {
        await checkReminders(now, previous, (m) => {
          if (active) notice(m);
        });
      } catch (e) {
        console.error("提醒检查失败", e);
      }
    };
    const timer = setInterval(tick, 15000);
    const visible = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [loading, notice]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        if (
          document.querySelector('[role="dialog"]') &&
          !document.querySelector(".search-modal")
        )
          return;
        e.preventDefault();
        setSearchOpen((v) => !v);
        return;
      }
      const target = e.target as HTMLElement | null;
      if (
        e.key !== "/" ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        target?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName || "") ||
        document.querySelector('[role="dialog"]')
      )
        return;
      e.preventDefault();
      setSearchOpen(true);
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    const unlock = () => {
      void unlockAudio();
    };
    document.addEventListener("pointerdown", unlock, { once: true });
    return () => document.removeEventListener("pointerdown", unlock);
  }, []);
  const act = useCallback(
    async (fn: (ts: Task[]) => Task[], message?: string) => {
      try {
        const next = await updateTasks(fn);
        setTasks(next);
        if (message) notice(message);
        return true;
      } catch (e) {
        notice((e as Error).message || "保存失败，请检查存储空间。");
        return false;
      }
    },
    [notice],
  );
  const active = useMemo(
    () => tasks.filter((t) => !t.deletedAt && t.kind !== "shortcut"),
    [tasks],
  );
  const shortcuts = tasks.filter((t) => !t.deletedAt && t.kind === "shortcut");
  const sites = active.filter((t) => t.url);
  const notes = active.filter((t) => !t.url).sort(noteSort);
  const dueTasks = active.filter((t) => due(t));
  const completed = dueTasks.filter((t) => done(t)).length;
  const toggle = (taskId: string, date = new Date()) =>
    void act((latest) =>
      latest.map((t) => {
        if (t.id !== taskId || t.deletedAt) return t;
        const key = t.repeat === "once" ? "__once__" : dayKey(date);
        return {
          ...t,
          completed: done(t, date)
            ? t.completed.filter((d) => d !== key)
            : [...new Set([...t.completed, key])],
        };
      }),
    );
  const remove = (taskId: string) => {
    setUndo([taskId]);
    void act(
      (ts) =>
        ts.map((t) =>
          t.id === taskId && !t.deletedAt ? { ...t, deletedAt: Date.now() } : t,
        ),
      "已移到回收站",
    );
  };
  const add = async (raw: string, daily = false) => {
    try {
      const p = quickParse(raw);
      const task = newTask(
        p.title,
        p.url,
        p.url && category !== "未分类" ? category : "",
      );
      if (daily && !p.url) task.repeat = "daily";
      return await act(
        (ts) => {
          if (
            p.url &&
            ts.some(
              (t) =>
                !t.deletedAt &&
                t.kind !== "shortcut" &&
                safeUrl(t.url) === p.url,
            )
          )
            throw Error("这个网址已经在清单里了。");
          return [...ts, task];
        },
        p.url ? "网站已贴好" : "随手记已贴好",
      );
    } catch (e) {
      notice((e as Error).message);
      return false;
    }
  };
  const addShortcut = (initial?: Partial<Task>) =>
    setShortcutEditor({
      task: { ...newTask(""), kind: "shortcut", ...initial },
      isNew: !initial?.id,
    });
  const quickSaveShortcut = async (raw: string, chosenCategory = "") => {
    try {
      const parsed = quickParse(raw);
      if (!parsed.url) throw Error("请粘贴完整网址，或输入名称加网址。");
      const entry = {
        ...newTask(parsed.title, parsed.url),
        kind: "shortcut" as const,
      };
      return await act((ts) => {
        if (
          ts.some(
            (t) =>
              !t.deletedAt &&
              t.kind === "shortcut" &&
              safeUrl(t.url) === parsed.url,
          )
        )
          throw Error("这个网址已经收录在常用入口。");
        entry.category =
          chosenCategory || guessShortcutCategory(parsed.url, ts);
        return [...ts, entry];
      });
    } catch (e) {
      notice((e as Error).message);
      return false;
    }
  };
  const captureTab = async () => {
    try {
      const page = await readCurrentTab();
      const entry = {
        ...newTask(page.title, page.url),
        kind: "shortcut" as const,
      };
      await act((ts) => {
        if (
          ts.some(
            (t) =>
              !t.deletedAt &&
              t.kind === "shortcut" &&
              safeUrl(t.url) === page.url,
          )
        )
          throw Error("当前网页已经在常用入口中。");
        entry.category = guessShortcutCategory(page.url, ts);
        return [...ts, entry];
      }, "已收下当前网页，可在常用入口整理");
    } catch (e) {
      notice((e as Error).message || "无法读取当前页面，请重试或手动添加。");
    }
  };
  const saveShortcut = async (task: Task) =>
    act((ts) => {
      const old = shortcutEditor;
      if (!old) throw Error("编辑状态已失效。");
      if (
        ts.some(
          (t) =>
            !t.deletedAt &&
            t.kind === "shortcut" &&
            t.id !== task.id &&
            safeUrl(t.url) === task.url,
        )
      )
        throw Error("这个网址已在常用入口中。");
      if (!old.isNew) {
        const current = ts.find((t) => t.id === task.id);
        if (!current || JSON.stringify(current) !== JSON.stringify(old.task))
          throw Error("入口已在其他页面修改，请重新打开。");
        return ts.map((t) => (t.id === task.id ? task : t));
      }
      return [...ts, task];
    }, "入口已保存").then((ok) => {
      if (ok) {
        clearCapturedDraft.current?.();
        clearCapturedDraft.current = null;
      }
      return ok;
    });
  const recordOpen = (taskId: string) =>
    void act((ts) =>
      ts.map((t) => {
        if (t.id !== taskId || t.deletedAt || t.kind !== "shortcut") return t;
        const now = new Date(),
          hours =
            Array.isArray(t.visitHours) && t.visitHours.length === 8
              ? t.visitHours.slice()
              : Array(8).fill(0),
          bucket = Math.floor(now.getHours() / 3);
        hours[bucket] = Math.min(1000000, (hours[bucket] || 0) + 1);
        return {
          ...t,
          visitCount: Math.min(1000000, (t.visitCount || 0) + 1),
          lastOpenedAt: now.getTime(),
          visitHours: hours,
        };
      }),
    );
  const openShortcut = (task: Task) => {
    const url = safeUrl(task.url);
    if (!url) {
      notice("网址无效，请编辑入口。");
      return;
    }
    if (extensionMode)
      void chrome.tabs
        .create({ url })
        .then(() => recordOpen(task.id))
        .catch(() => notice("无法打开网址，请重试。"));
    else {
      window.open(url, "_blank", "noopener,noreferrer");
      recordOpen(task.id);
    }
  };
  const pinShortcut = (taskId: string) =>
    void act((ts) =>
      ts.map((t) =>
        t.id === taskId && !t.deletedAt && t.kind === "shortcut"
          ? { ...t, pinned: !t.pinned }
          : t,
      ),
    );
  const edit = (task: Task) => setEditor({ task, isNew: false });
  const addEditor = (website = false) =>
    setEditor({
      task: newTask("", website ? "https://" : "", category),
      isNew: true,
    });
  const save = async (task: Task, original: Task | null) =>
    act(
      (ts) => {
        if (original) {
          const current = ts.find((t) => t.id === original.id);
          if (!current || JSON.stringify(current) !== JSON.stringify(original))
            throw Error("任务已在其他页面修改，请重新打开。");
          return ts.map((t) => (t.id === original.id ? task : t));
        }
        if (
          task.url &&
          ts.some(
            (t) =>
              !t.deletedAt &&
              t.kind !== "shortcut" &&
              safeUrl(t.url) === task.url,
          )
        )
          throw Error("这个网址已经在清单里了。");
        return [...ts, task];
      },
      original ? "任务已更新" : "任务已添加",
    ).then((ok) => {
      if (ok) {
        clearCapturedDraft.current?.();
        clearCapturedDraft.current = null;
      }
      return ok;
    });
  const reorder = (ids: string[]) =>
    void act((ts) => {
      const valid = ts.filter((t) => !t.deletedAt && !t.url).sort(noteSort);
      const requested = ids.filter((x) => valid.some((t) => t.id === x));
      const all = [
        ...requested,
        ...valid.map((t) => t.id).filter((x) => !requested.includes(x)),
      ];
      const order = new Map(all.map((x, i) => [x, i]));
      return ts.map((t) =>
        !t.deletedAt && !t.url && order.has(t.id)
          ? { ...t, noteOrder: order.get(t.id) }
          : t,
      );
    }, "位置已保存");
  const tidy = () => {
    const sorted = [...notes].sort(
      (a, b) => Number(done(a)) - Number(done(b)) || a.createdAt - b.createdAt,
    );
    reorder(sorted.map((t) => t.id));
    notice("已按未完成、已完成整理");
  };
  const exportData = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          { version: 1, exportedAt: new Date().toISOString(), tasks },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const u = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = u;
    a.download = `dailydock-${dayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
    notice("已导出备份文件");
  };
  const importData = async () => {
    if (!importFile) return;
    try {
      if (importFile.size > 20_000_000)
        throw Error("文件超过 20MB，无法导入。");
      const incoming = parseBackup(JSON.parse(await importFile.text()));
      if (await act(() => incoming, `已导入 ${incoming.length} 项任务`)) {
        setView("today");
        setSearch("");
        setCategory("");
      }
    } catch (e) {
      notice("导入失败：" + (e as Error).message);
    } finally {
      setImportFile(null);
    }
  };
  const categories = [
    ...new Set(sites.map((t) => t.category || "未分类")),
  ].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const shownSites = sites
    .filter(
      (t) =>
        (!category || (t.category || "未分类") === category) &&
        [t.title, t.url, t.category].some((x) =>
          x.toLocaleLowerCase().includes(search.toLocaleLowerCase().trim()),
        ),
    )
    .sort((a, b) => a.createdAt - b.createdAt);
  const suggestions = suggestedShortcuts(shortcuts);
  const notesProps = {
    notes,
    onReorder: reorder,
    onTidy: tidy,
    onToggle: toggle,
    onEdit: edit,
    onDelete: remove,
  };
  const labels: Record<View, string> = {
    shortcuts: "常用入口",
    sites: "网站签到",
    notes: "便利贴",
    calendar: "日历",
    today: "今天",
    all: "全部任务",
    trash: "回收站",
    settings: "设置",
  };
  const navigate = (next: View) => {
    location.hash = next;
    setView(next);
    setSelecting(false);
    setSelection([]);
    setSearch("");
    setCategory("");
    setFilter("all");
    setMobileOpen(false);
  };
  const capture = async (raw: string, kind: CaptureKind) => {
    if (kind === "shortcut") return quickSaveShortcut(raw);
    if (kind === "site") {
      try {
        if (!quickParse(raw).url) throw Error("请填写网站网址。");
        return add(raw);
      } catch (e) {
        notice((e as Error).message);
        return false;
      }
    }
    const title = raw.trim();
    if (!title || title.length > 160) {
      notice("事项名称请控制在 1–160 个字。");
      return false;
    }
    return act((ts) => [...ts, newTask(title)], "已添加待办");
  };
  const captureDetail = (raw: string, kind: CaptureKind, clear: () => void) => {
    clearCapturedDraft.current = clear;
    try {
      const parsed = raw.trim() ? quickParse(raw) : { title: "", url: "" };
      if (kind === "shortcut") {
        addShortcut({ title: parsed.title, url: parsed.url });
        return;
      }
      setEditor({
        task: {
          ...newTask(
            kind === "task" ? raw.trim() : parsed.title,
            kind === "site" ? parsed.url : "",
          ),
          date: dayKey(),
        },
        isNew: true,
      });
    } catch (e) {
      notice((e as Error).message);
    }
  };
  const restore = (task: Task) =>
    void act((ts) => {
      if (
        task.kind === "shortcut" &&
        ts.some(
          (x) =>
            x.id !== task.id &&
            !x.deletedAt &&
            x.kind === "shortcut" &&
            safeUrl(x.url) === safeUrl(task.url),
        )
      )
        throw Error("已有相同网址的入口，请先处理重复项。");
      return ts.map((t) =>
        t.id === task.id ? { ...t, deletedAt: undefined } : t,
      );
    }, "已恢复");
  const undoDelete = async () => {
    if (
      await act((ts) => {
        const restoring = ts.filter((t) => undo.includes(t.id));
        if (
          restoring.some(
            (t) =>
              t.kind === "shortcut" &&
              ts.some(
                (x) =>
                  x.id !== t.id &&
                  !x.deletedAt &&
                  x.kind === "shortcut" &&
                  safeUrl(x.url) === safeUrl(t.url),
              ),
          )
        )
          throw Error("已有相同网址的入口，请从回收站处理。");
        return ts.map((t) =>
          undo.includes(t.id) ? { ...t, deletedAt: undefined } : t,
        );
      }, "已撤销删除")
    )
      setUndo([]);
  };
  const pending = dueTasks
    .filter((t) => !done(t))
    .sort(
      (a, b) =>
        (a.time || "99:99").localeCompare(b.time || "99:99") ||
        a.createdAt - b.createdAt,
    );
  const matching = (view === "today" ? dueTasks : active).filter(
    (t) =>
      (filter === "all" || (filter === "done" ? done(t) : !done(t))) &&
      [t.title, t.category, t.url].some((x) =>
        x.toLowerCase().includes(search.trim().toLowerCase()),
      ),
  );
  const bulk = async (action: "complete" | "delete") => {
    const ok = await act(
      (ts) =>
        ts.map((t) => {
          if (!selection.includes(t.id) || t.deletedAt) return t;
          return action === "delete"
            ? { ...t, deletedAt: Date.now() }
            : {
                ...t,
                completed: [
                  ...new Set([
                    ...t.completed,
                    t.repeat === "once" ? "__once__" : dayKey(),
                  ]),
                ],
              };
        }),
      action === "delete" ? "已移到回收站" : "所选事项已完成",
    );
    if (ok) {
      if (action === "delete") setUndo(selection);
      setSelection([]);
      setSelecting(false);
    }
  };
  const list = (items: Task[]) => (
    <TaskList
      items={items}
      selected={view === "all" && selecting ? selection : undefined}
      onSelect={(id) =>
        setSelection((current) =>
          current.includes(id)
            ? current.filter((x) => x !== id)
            : [...current, id],
        )
      }
      onToggle={toggle}
      onEdit={edit}
      onDelete={remove}
      onOpen={openWebsite}
    />
  );
  const sidebar = (
    <>
      <div className="sidebar-top">
        <button
          className="brand"
          onClick={() => navigate("today")}
          aria-label="DailyDock 首页"
        >
          <span>
            <Check size={18} />
          </span>
          <b>DailyDock</b>
        </button>
        <button
          className="icon-button desktop-toggle"
          aria-label={settings.sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
          onClick={() =>
            void updateSettings({
              sidebarCollapsed: !settings.sidebarCollapsed,
            })
              .then(setSettings)
              .catch(() => notice("保存设置失败"))
          }
        >
          <PanelLeft size={18} />
        </button>
      </div>
      <button
        className="new-button"
        onClick={() => {
          setMobileOpen(false);
          addEditor();
        }}
        title="新建事项"
      >
        <Plus size={18} />
        <span>新建事项</span>
      </button>
      <button
        className="nav-search"
        onClick={() => {
          setSearchOpen(true);
          setMobileOpen(false);
        }}
        title="搜索全部内容"
      >
        <Search size={18} />
        <span>搜索</span>
        <kbd>Ctrl K</kbd>
      </button>
      <nav aria-label="主要导航">
        {menus.slice(0, 6).map(([key, label, Icon], i) => (
          <div key={key} className={i === 3 ? "nav-divider" : ""}>
            <button
              title={label}
              aria-label={label}
              aria-current={view === key ? "page" : undefined}
              className={"nav-item " + (view === key ? "active" : "")}
              onClick={() => navigate(key)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {key === "today" && pending.length > 0 && (
                <small>{pending.length}</small>
              )}
            </button>
          </div>
        ))}
      </nav>
      <div className="sidebar-bottom">
        {menus.slice(6).map(([key, label, Icon]) => (
          <button
            key={key}
            title={label}
            aria-label={label}
            className={"nav-item " + (view === key ? "active" : "")}
            onClick={() => navigate(key)}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
        <div className="local-status">
          <span />
          本地工作空间
        </div>
      </div>
    </>
  );
  if (loading)
    return (
      <main className="loading" role="status">
        <span className="spinner" />
        正在加载工作空间…
      </main>
    );
  if (fatal)
    return (
      <main className="loading">
        <h1>无法读取本地数据</h1>
        <p>{fatal}</p>
        <p>请保留现有存储，检查浏览器设置或从备份恢复。</p>
        <button className="button" onClick={() => location.reload()}>
          重新加载
        </button>
      </main>
    );
  const dialogs = (
    <>
      {shortcutEditor && (
        <ShortcutDialog
          task={shortcutEditor.task}
          isNew={shortcutEditor.isNew}
          categories={[
            ...new Set(shortcuts.map((t) => t.category).filter(Boolean)),
          ]}
          open
          onClose={() => {
            clearCapturedDraft.current = null;
            setShortcutEditor(null);
          }}
          onSave={saveShortcut}
        />
      )}{" "}
      {editor && (
        <Editor
          task={editor.task}
          isNew={editor.isNew}
          open
          onClose={() => {
            clearCapturedDraft.current = null;
            setEditor(null);
          }}
          onSave={save}
        />
      )}
      <SearchDialog
        key={String(searchOpen)}
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        tasks={tasks}
        onChoose={(t) => (t.kind === "shortcut" ? openShortcut(t) : edit(t))}
      />
      <AlertDialog.Root
        open={!!purge}
        onOpenChange={(v) => !v && setPurge(null)}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="modal-overlay" />
          <AlertDialog.Content className="confirm-modal">
            <AlertDialog.Title>永久删除此项？</AlertDialog.Title>
            <AlertDialog.Description>
              「{purge?.title}」的内容和完成记录将无法恢复。
            </AlertDialog.Description>
            <div className="button-row">
              <AlertDialog.Cancel className="button">取消</AlertDialog.Cancel>
              <AlertDialog.Action
                className="button danger"
                onClick={() => {
                  if (purge)
                    void act(
                      (ts) =>
                        ts.filter((t) => t.id !== purge.id || !t.deletedAt),
                      "已永久删除",
                    );
                  setPurge(null);
                }}
              >
                永久删除
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
      <AlertDialog.Root
        open={!!importFile}
        onOpenChange={(v) => !v && setImportFile(null)}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="modal-overlay" />
          <AlertDialog.Content className="confirm-modal">
            <AlertDialog.Title>导入备份并覆盖数据？</AlertDialog.Title>
            <AlertDialog.Description>
              导入将替换全部内容和回收站。请先导出当前备份。
            </AlertDialog.Description>
            <div className="button-row">
              <AlertDialog.Cancel className="button">取消</AlertDialog.Cancel>
              <AlertDialog.Action
                className="button primary"
                onClick={(e) => {
                  e.preventDefault();
                  void importData();
                }}
              >
                确认导入
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
  const feedback = toast && (
    <div className="toast" role="status">
      <Check size={16} />
      <span>{toast}</span>
      {undo.length > 0 && toast === "已移到回收站" && (
        <button onClick={() => void undoDelete()}>撤销</button>
      )}
      <button aria-label="关闭提示" onClick={() => setToast("")}>
        <X size={15} />
      </button>
    </div>
  );
  if (popup)
    return (
      <main className="popup-shell">
        <div className="popup-head">
          <b>DailyDock</b>
          <button
            className="icon-button"
            aria-label="打开管理页面"
            onClick={() => void chrome.runtime.openOptionsPage()}
          >
            <ExternalLink size={18} />
          </button>
        </div>
        <h1>今天</h1>
        <p className="muted">
          {pending.length
            ? `还有 ${pending.length} 件事，慢慢来。`
            : "今日事项已完成。"}
        </p>
        <button
          className="button popup-capture"
          onClick={() => void captureTab()}
        >
          <Bookmark size={16} />
          收录当前网页
        </button>
        <Capture onSave={capture} onDetail={captureDetail} />
        {list(pending)}
        <button
          className="text-button"
          onClick={() => void chrome.runtime.openOptionsPage()}
        >
          打开工作空间 <ArrowRight size={16} />
        </button>
        {dialogs}
        {feedback}
      </main>
    );
  return (
    <div
      className={"app-shell " + (settings.sidebarCollapsed ? "collapsed" : "")}
    >
      <a href="#main" className="skip-link">
        跳到主内容
      </a>
      <aside className="sidebar desktop-sidebar">{sidebar}</aside>
      <main className="workspace" id="main">
        <header className="workspace-bar">
          <div>
            <button
              className="icon-button mobile-menu"
              aria-label="打开导航"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={20} />
            </button>
            <span>个人空间</span>
            <span className="bar-separator">/</span>
            <b>{labels[view]}</b>
          </div>
          <button
            className="icon-button"
            title="搜索全部内容"
            aria-label="搜索全部内容"
            onClick={() => setSearchOpen(true)}
          >
            <Search size={18} />
          </button>
        </header>
        <div className={"content " + (view === "calendar" ? "wide" : "")}>
          <header className="page-header">
            <div>
              {view === "today" && (
                <p className="page-date">
                  {new Date().toLocaleDateString("zh-CN", {
                    month: "long",
                    day: "numeric",
                    weekday: "long",
                  })}
                </p>
              )}
              <h1>{labels[view]}</h1>
              <p>
                {view === "today"
                  ? pending.length
                    ? `还有 ${pending.length} 件待办，专注眼前的一件事。`
                    : "今日事项已完成，留点时间给自己。"
                  : view === "notes"
                    ? "随手记录，按自己的节奏整理。"
                    : view === "calendar"
                      ? "给每件事留一个合适的时间。"
                      : view === "sites"
                        ? "打开网站完成签到，再回来勾选。"
                        : view === "shortcuts"
                          ? "常去的地方，随时触达。"
                          : view === "all"
                            ? "所有安排，都在这里。"
                            : view === "trash"
                              ? "误删的内容可以随时恢复。"
                              : "按你的习惯调整工作空间。"}
              </p>
            </div>
            {view === "today" ? (
              <div className="today-progress">
                <span>
                  {completed} / {dueTasks.length} 已完成
                </span>
                <progress max={dueTasks.length || 1} value={completed} />
              </div>
            ) : view === "sites" ? (
              <button className="button" onClick={() => addEditor(true)}>
                <Plus size={16} />
                添加网站
              </button>
            ) : view === "shortcuts" ? (
              <button className="button" onClick={() => addShortcut()}>
                <Plus size={16} />
                添加入口
              </button>
            ) : view === "notes" || view === "all" ? (
              <button className="button" onClick={() => addEditor()}>
                <Plus size={16} />
                新建事项
              </button>
            ) : null}
          </header>
          {view === "today" && (
            <>
              <Capture onSave={capture} onDetail={captureDetail} />
              {settings.suggestionsEnabled !== false &&
                suggestions.length > 0 && (
                  <section className="suggestion-shelf">
                    <div className="section-heading">
                      <h2>常用入口</h2>
                      <button
                        className="text-button"
                        onClick={() => navigate("shortcuts")}
                      >
                        全部 <ArrowRight size={14} />
                      </button>
                    </div>
                    <div className="suggestion-items">
                      {suggestions.map((t) => (
                        <button key={t.id} onClick={() => openShortcut(t)}>
                          <span>{t.title.charAt(0).toUpperCase()}</span>
                          {t.title}
                          <ArrowRight size={13} />
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              <section className="today-list">
                <div className="section-heading">
                  <h2>
                    待办事项 <small>{pending.length}</small>
                  </h2>
                  <button
                    className="text-button"
                    onClick={() => navigate("calendar")}
                  >
                    <CalendarDays size={15} />
                    查看日历
                  </button>
                </div>
                {pending.length ? (
                  list(pending)
                ) : (
                  <div className="empty-state">
                    <CircleCheck size={26} />
                    <h3>今天的事，都处理好了</h3>
                    <p>记录新想法，或者看看接下来的安排。</p>
                  </div>
                )}
                {completed > 0 && (
                  <details className="completed-section">
                    <summary>已完成 · {completed}</summary>
                    {list(dueTasks.filter((t) => done(t)))}
                  </details>
                )}
              </section>
            </>
          )}
          {view === "shortcuts" && (
            <Shortcuts
              items={shortcuts}
              onAdd={(category) => addShortcut({ category })}
              onQuickAdd={quickSaveShortcut}
              onEdit={(task) => setShortcutEditor({ task, isNew: false })}
              onDelete={remove}
              onPin={pinShortcut}
              onOpen={openShortcut}
            />
          )}
          {view === "sites" && (
            <>
              <div className="site-overview">
                <span>
                  {sites.filter((t) => due(t) && done(t)).length} /{" "}
                  {sites.filter((t) => due(t)).length} 今日已签到
                </span>
                <span>签到状态由你手动记录</span>
              </div>
              <div className="search-bar">
                <Search size={17} />
                <input
                  aria-label="搜索网站"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索网站名称、分类或网址"
                />
                {search && (
                  <button className="text-button" onClick={() => setSearch("")}>
                    清除
                  </button>
                )}
              </div>
              <div className="chips" role="group" aria-label="网站分类">
                {["", ...categories].map((c) => (
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
              <div className="site-grid">
                {shownSites.map((t) => (
                  <article
                    className={"site-card " + (done(t) ? "checked" : "")}
                    key={t.id}
                  >
                    <button
                      className="site-launch"
                      aria-label={`打开网站：${t.title}`}
                      onClick={() => openWebsite(t)}
                    >
                      <WebsiteIcon url={t.url} title={t.title} />
                      <strong>{t.title}</strong>
                    </button>
                    <footer>
                      <label>
                        <input
                          type="checkbox"
                          aria-label={`标记签到：${t.title}`}
                          checked={done(t)}
                          onChange={() => toggle(t.id)}
                        />
                        {done(t) ? "已签到" : "待签到"}
                      </label>
                      <button
                        className="icon-button"
                        aria-label={`编辑：${t.title}`}
                        onClick={() => edit(t)}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`移到回收站：${t.title}`}
                        onClick={() => remove(t.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </footer>
                  </article>
                ))}
              </div>
              {!shownSites.length && (
                <div className="empty-state">
                  <p>没有找到网站</p>
                  <button
                    className="text-button"
                    onClick={() => {
                      setSearch("");
                      setCategory("");
                    }}
                  >
                    清除筛选
                  </button>
                </div>
              )}
            </>
          )}
          {view === "notes" && (
            <>
              <Capture onSave={capture} onDetail={captureDetail} />
              <Notes {...notesProps} />
            </>
          )}
          {view === "calendar" && (
            <Calendar
              tasks={active}
              onToggle={toggle}
              onEdit={edit}
              onDelete={remove}
              onOpen={openWebsite}
              onAdd={(date) =>
                setEditor({
                  task: { ...newTask(""), date: dayKey(date) },
                  isNew: true,
                })
              }
            />
          )}
          {view === "all" && (
            <>
              <div className="search-bar">
                <Search size={17} />
                <input
                  aria-label="搜索任务"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索任务、分类或网址"
                />
                {search && (
                  <button className="text-button" onClick={() => setSearch("")}>
                    清除
                  </button>
                )}
              </div>
              <div className="list-toolbar">
                <div className="segmented" aria-label="任务状态">
                  {[
                    ["all", "全部"],
                    ["pending", "待完成"],
                    ["done", "已完成"],
                  ].map(([v, l]) => (
                    <button
                      key={v}
                      aria-pressed={filter === v}
                      onClick={() => setFilter(v)}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <div className="selection-controls">
                  <small>{matching.length} 项</small>
                  <button
                    className="text-button"
                    onClick={() => {
                      setSelecting((v) => !v);
                      setSelection([]);
                    }}
                  >
                    {selecting ? "取消选择" : "选择"}
                  </button>
                </div>
              </div>
              {selecting && (
                <div className="bulk-toolbar">
                  <label>
                    <input
                      type="checkbox"
                      aria-label="选择当前结果"
                      checked={
                        matching.length > 0 &&
                        matching.every((t) => selection.includes(t.id))
                      }
                      onChange={(e) =>
                        setSelection(
                          e.target.checked ? matching.map((t) => t.id) : [],
                        )
                      }
                    />
                    已选 {selection.length} 项
                  </label>
                  <button
                    className="button"
                    disabled={!selection.length}
                    onClick={() => void bulk("complete")}
                  >
                    标记完成
                  </button>
                  <button
                    className="button danger"
                    disabled={!selection.length}
                    onClick={() => void bulk("delete")}
                  >
                    移到回收站
                  </button>
                </div>
              )}
              {list(
                matching.sort(
                  (a, b) =>
                    Number(done(a)) - Number(done(b)) ||
                    (a.date || "9999").localeCompare(b.date || "9999") ||
                    (a.time || "99").localeCompare(b.time || "99"),
                ),
              )}
              {!matching.length && (
                <div className="empty-state">没有符合条件的事项。</div>
              )}
            </>
          )}
          {view === "trash" && (
            <>
              {tasks
                .filter((t) => t.deletedAt)
                .sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0))
                .map((t) => (
                  <div className="trash-row" key={t.id}>
                    <Trash2 size={17} />
                    <div>
                      <b>{t.title}</b>
                      <small>
                        {t.kind === "shortcut"
                          ? "常用入口"
                          : t.url
                            ? "网站"
                            : "待办 / 便签"}{" "}
                        · {new Date(t.deletedAt!).toLocaleDateString("zh-CN")}
                      </small>
                    </div>
                    <button className="button" onClick={() => restore(t)}>
                      恢复
                    </button>
                    <button
                      className="icon-button danger-text"
                      aria-label={`永久删除：${t.title}`}
                      onClick={() => setPurge(t)}
                    >
                      <X size={17} />
                    </button>
                  </div>
                ))}
              {!tasks.some((t) => t.deletedAt) && (
                <div className="empty-state">
                  <Trash2 size={26} />
                  <h3>回收站为空</h3>
                  <p>删除的内容会先放在这里。</p>
                </div>
              )}
            </>
          )}
          {view === "settings" && (
            <SettingsPage
              settings={settings}
              onSettings={(s) => {
                setSettings((current) => ({ ...current, ...s }));
                void updateSettings(s)
                  .then(setSettings)
                  .catch(() => {
                    notice("保存设置失败");
                    void refresh();
                  });
              }}
              onExport={exportData}
              onImport={setImportFile}
              onNotice={notice}
            />
          )}
        </div>
        <footer className="workspace-foot">
          仅保存在本机 <span>·</span>{" "}
          <button onClick={() => navigate("settings")}>数据与偏好</button>
        </footer>
      </main>
      <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="modal-overlay nav-overlay" />
          <Dialog.Content className="sidebar mobile-sidebar">
            <Dialog.Title className="visually-hidden">导航</Dialog.Title>
            <Dialog.Description className="visually-hidden">
              选择工作空间页面。
            </Dialog.Description>
            <Dialog.Close
              className="icon-button mobile-nav-close"
              aria-label="关闭导航"
            >
              <X size={18} />
            </Dialog.Close>
            {sidebar}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {dialogs}
      {feedback}
    </div>
  );
}
