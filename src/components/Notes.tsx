import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, ArrowRight, Pencil, Trash2, Bell, Pin } from "lucide-react";
import { type Task, done } from "../model";
interface Props {
  notes: Task[];
  onReorder: (ids: string[]) => void;
  onTidy: () => void;
  onToggle: (id: string) => void;
  onEdit: (t: Task) => void;
  onDelete: (id: string) => void;
}
function Note({
  task,
  index,
  total,
  onToggle,
  onEdit,
  onDelete,
  onMove,
}: {
  task: Task;
  index: number;
  total: number;
  onToggle: Props["onToggle"];
  onEdit: Props["onEdit"];
  onDelete: Props["onDelete"];
  onMove: (d: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });
  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
      }}
      className={
        "paper-note " +
        (isDragging ? "dragging " : "") +
        (done(task) ? "is-done" : "")
      }
    >
      <div className="note-top">
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="pin-handle"
          aria-label={`按住图钉拖动排序：${task.title}`}
          title="按住图钉拖动"
        >
          <Pin size={16} />
        </button>
        <span>{String(index + 1).padStart(2, "0")}</span>
      </div>
      <p>{task.title}</p>
      <button
        className="note-date"
        onClick={() => onEdit(task)}
        aria-label={`设置日期和提醒：${task.title}`}
      >
        <Bell size={13} />
        {task.date || task.time
          ? [task.date, task.time, task.remind ? "提醒已开" : ""]
              .filter(Boolean)
              .join(" · ")
          : "设置日期和提醒"}
      </button>
      <footer>
        <label>
          <input
            type="checkbox"
            aria-label={`${done(task) ? "取消完成" : "标记完成"}：${task.title}`}
            checked={done(task)}
            onChange={() => onToggle(task.id)}
          />
          {done(task) ? "完成了" : "待完成"}
        </label>
        <div className="note-actions">
          <button
            aria-label={`前移：${task.title}`}
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowLeft size={15} />
          </button>
          <button
            aria-label={`后移：${task.title}`}
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            <ArrowRight size={15} />
          </button>
          <button
            aria-label={`编辑：${task.title}`}
            onClick={() => onEdit(task)}
          >
            <Pencil size={15} />
          </button>
          <button
            aria-label={`移到回收站：${task.title}`}
            onClick={() => onDelete(task.id)}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </footer>
    </article>
  );
}
export function Notes({
  notes,
  onReorder,
  onTidy,
  onToggle,
  onEdit,
  onDelete,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const reorder = (a: number, b: number) => {
    if (b >= 0 && b < notes.length)
      onReorder(arrayMove(notes, a, b).map((t) => t.id));
  };
  const end = (e: DragEndEvent) => {
    if (e.over && e.active.id !== e.over.id)
      reorder(
        notes.findIndex((t) => t.id === e.active.id),
        notes.findIndex((t) => t.id === e.over!.id),
      );
  };
  return (
    <section className="notes-section">
      <header className="section-heading">
        <div>
          <h2>
            便利贴 <small>{notes.length}</small>
          </h2>
        </div>
        <div className="note-toolbar">
          <span>拖动图钉排序</span>
          <button
            className="button"
            disabled={notes.length < 2}
            onClick={onTidy}
          >
            一键整理
          </button>
        </div>
      </header>
      {notes.length ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={end}
          accessibility={{
            screenReaderInstructions: {
              draggable:
                "按空格拿起便签，使用方向键移动，再按空格放下，按 Escape 取消。",
            },
            announcements: {
              onDragStart: ({ active }) =>
                `已拿起${notes.find((t) => t.id === active.id)?.title || "便签"}`,
              onDragOver: ({ over }) =>
                over
                  ? `移动至${notes.find((t) => t.id === over.id)?.title || "便签"}的位置`
                  : "已移出便签区域",
              onDragEnd: () => "已放下便签",
              onDragCancel: () => "已取消移动",
            },
          }}
        >
          <SortableContext
            items={notes.map((t) => t.id)}
            strategy={rectSortingStrategy}
          >
            <div className="notes-tray">
              {notes.map((t, i) => (
                <Note
                  key={t.id}
                  task={t}
                  index={i}
                  total={notes.length}
                  onToggle={onToggle}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onMove={(d) => reorder(i, i + d)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="empty-note">
          还没有便签。在上方记录一件事，就能在这里整理。
        </div>
      )}
    </section>
  );
}
