import { useState, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';
import type { Playlist } from '@aske/shared';
import { useT } from '../i18n';
import { dropAction } from '../storage/playlistOps';
import { useLibrary } from '../stores/library';
import { MergeSheet } from './MergeSheet';

interface Props {
  playlists: Playlist[];
  /** Shows the "drop here to take it out of the folder" zone while dragging. */
  rootZone?: boolean;
  children: ReactNode;
}

// The dragged row is also a drop target; ignore it so only other rows count.
const collisionWithoutSelf: CollisionDetection = (args) =>
  pointerWithin(args).filter((c) => c.id !== args.active.id);

/** Drag & drop context for the playlist lists: move into folders or merge onto another playlist. */
export function PlaylistDnd({ playlists, rootZone, children }: Props) {
  const t = useT();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [merge, setMerge] = useState<{ targetId: string; sourceId: string } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const onDragStart = ({ active }: DragStartEvent) => setActiveId(String(active.id));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    const result = dropAction(String(active.id), over ? String(over.id) : null, playlists);
    if (!result) return;
    if (result.kind === 'move') {
      void useLibrary.getState().movePlaylist(result.playlistId, result.folderId);
    } else {
      setMerge({ targetId: result.targetId, sourceId: result.sourceId });
    }
  };

  const dragged = activeId?.startsWith('pl:')
    ? playlists.find((p) => p.id === activeId.slice(3))
    : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionWithoutSelf}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {children}
      {rootZone && activeId && <RootDropZone label={t('drag.dropRoot')} />}
      <DragOverlay>{dragged && <div className="drag-overlay">{dragged.name}</div>}</DragOverlay>
      {merge && <MergeSheet {...merge} onClose={() => setMerge(null)} />}
    </DndContext>
  );
}

function RootDropZone({ label }: { label: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'root' });
  return (
    <div ref={setNodeRef} className={`drop-root${isOver ? ' drop-over' : ''}`}>
      {label}
    </div>
  );
}

/** A playlist row: draggable by its handle only, and a merge target for other playlists. */
export function DraggablePlaylist({
  playlist,
  children,
}: {
  playlist: Playlist;
  children: (handle: ReactNode) => ReactNode;
}) {
  const t = useT();
  const id = `pl:${playlist.id}`;
  const drag = useDraggable({ id });
  const drop = useDroppable({ id });
  const handle = (
    <button
      ref={drag.setActivatorNodeRef}
      className="icon-btn drag-handle"
      aria-label={t('drag.handle')}
      title={t('drag.handle')}
      {...drag.attributes}
      {...drag.listeners}
    >
      <GripVertical size={18} />
    </button>
  );
  const highlight = drop.isOver && !drag.isDragging;
  return (
    <div
      ref={(node) => {
        drag.setNodeRef(node);
        drop.setNodeRef(node);
      }}
      className={`dnd-row${drag.isDragging ? ' dragging' : ''}${highlight ? ' drop-over' : ''}`}
    >
      {children(handle)}
    </div>
  );
}

/** A folder row: playlists can be dropped on it. */
export function DroppableFolder({ folderId, children }: { folderId: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `folder:${folderId}` });
  return (
    <div ref={setNodeRef} className={`dnd-row${isOver ? ' drop-over' : ''}`}>
      {children}
    </div>
  );
}
