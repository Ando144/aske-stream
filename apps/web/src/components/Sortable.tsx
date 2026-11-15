import type { ReactNode } from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface Props<T> {
  items: T[];
  /** Must be unique per row (lists may contain the same song twice). */
  keyOf: (item: T, index: number) => string;
  onMove: (from: number, to: number) => void;
  render: (item: T, index: number, handle: ReactNode) => ReactNode;
  handleLabel: string;
}

/**
 * Drag-to-reorder list. Only the ⠿ handle starts a drag, so the list still
 * scrolls normally with a finger; keyboard users can move rows with space + arrows.
 */
export function SortableList<T>({ items, keyOf, onMove, render, handleLabel }: Props<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const keys = items.map((item, i) => keyOf(item, i));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = keys.indexOf(String(active.id));
    const to = keys.indexOf(String(over.id));
    if (from >= 0 && to >= 0) onMove(from, to);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={keys} strategy={verticalListSortingStrategy}>
        {items.map((item, i) => (
          <SortableRow key={keys[i]} id={keys[i]!} handleLabel={handleLabel}>
            {(handle) => render(item, i, handle)}
          </SortableRow>
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  handleLabel,
  children,
}: {
  id: string;
  handleLabel: string;
  children: (handle: ReactNode) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const handle = (
    <button
      ref={setActivatorNodeRef}
      className="icon-btn drag-handle"
      aria-label={handleLabel}
      {...attributes}
      {...listeners}
    >
      <GripVertical size={18} />
    </button>
  );
  return (
    <div
      ref={setNodeRef}
      className={`sortable-row${isDragging ? ' dragging' : ''}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      {children(handle)}
    </div>
  );
}
