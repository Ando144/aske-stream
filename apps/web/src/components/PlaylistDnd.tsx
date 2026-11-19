import { useState, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pin } from 'lucide-react';
import { sortFolders, type Folder, type Playlist } from '@aske/shared';
import { useT } from '../i18n';
import { dropAction } from '../storage/playlistOps';
import { useLibrary } from '../stores/library';

interface Props {
  playlists: Playlist[];
  /** Folders of the list; they can be reordered and receive dropped playlists. */
  folders?: Folder[];
  /** Shows the "drop here to take it out of the folder" zone while dragging. */
  rootZone?: boolean;
  children: ReactNode;
}

const NO_FOLDERS: Folder[] = [];

// A dragged folder only competes with other folders; a dragged playlist with folders and "root".
const collisionByKind: CollisionDetection = (args) => {
  const activeId = String(args.active.id);
  if (activeId.startsWith('folder:')) {
    const containers = args.droppableContainers.filter(
      (c) => String(c.id).startsWith('folder:') && c.id !== args.active.id,
    );
    return closestCenter({ ...args, droppableContainers: containers });
  }
  return pointerWithin(args).filter((c) => c.id !== args.active.id);
};

/** Drag & drop context for the playlist lists: playlists into folders, folders into a new order. */
export function PlaylistDnd({ playlists, folders = NO_FOLDERS, rootZone, children }: Props) {
  const t = useT();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragStart = ({ active }: DragStartEvent) => setActiveId(String(active.id));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    const result = dropAction(String(active.id), over ? String(over.id) : null, playlists, folders);
    if (!result) return;
    const library = useLibrary.getState();
    if (result.kind === 'move') void library.movePlaylist(result.playlistId, result.folderId);
    else if (result.kind === 'reorderFolders') void library.reorderFolders(result.folderIds);
    else void library.orderPlaylists(result.folderId, result.playlistIds);
  };

  const dragged = draggedName(activeId, playlists, folders);
  const folderIds = sortFolders(folders).map((f) => `folder:${f.id}`);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionByKind}
      autoScroll={{ threshold: { x: 0, y: 0.2 }, acceleration: 20 }}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={folderIds} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
      {rootZone && activeId && <RootDropZone label={t('drag.dropRoot')} />}
      <DragOverlay>{dragged && <div className="drag-overlay">{dragged}</div>}</DragOverlay>
    </DndContext>
  );
}

function draggedName(activeId: string | null, playlists: Playlist[], folders: Folder[]) {
  if (!activeId) return undefined;
  if (activeId.startsWith('pl:')) return playlists.find((p) => p.id === activeId.slice(3))?.name;
  return folders.find((f) => `folder:${f.id}` === activeId)?.name;
}

function RootDropZone({ label }: { label: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'root' });
  return (
    <div ref={setNodeRef} className={`drop-root${isOver ? ' drop-over' : ''}`}>
      {label}
    </div>
  );
}

/**
 * A playlist row: draggable by its handle, and a drop target for other playlists of the same
 * place (to reorder). Pinned rows show a pin instead of the handle and take no part in dragging.
 */
export function DraggablePlaylist({
  playlist,
  children,
}: {
  playlist: Playlist;
  children: (handle: ReactNode) => ReactNode;
}) {
  const t = useT();
  const pinned = playlist.pinnedAt != null;
  const drag = useSortable({ id: `pl:${playlist.id}`, disabled: pinned });
  const draggingOther = String(drag.active?.id ?? '').startsWith('pl:') && !drag.isDragging;
  const handle = pinned ? (
    <span className="icon-btn pinned-mark" role="img" aria-label={t('pin.pinned')}>
      <Pin size={18} />
    </span>
  ) : (
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
  const highlight = drag.isOver && draggingOther && !pinned;
  return (
    <div
      ref={drag.setNodeRef}
      className={`dnd-row${drag.isDragging ? ' dragging' : ''}${highlight ? ' drop-over' : ''}`}
    >
      {children(handle)}
    </div>
  );
}

/** A folder row: sortable by its handle, and a drop target for playlists. */
export function SortableFolder({
  folderId,
  pinned = false,
  children,
}: {
  folderId: string;
  pinned?: boolean;
  children: (handle: ReactNode) => ReactNode;
}) {
  const t = useT();
  // A pinned folder cannot be dragged, but it still receives dropped playlists.
  const sortable = useSortable({ id: `folder:${folderId}`, disabled: { draggable: pinned } });
  const draggingPlaylist = String(sortable.active?.id ?? '').startsWith('pl:');
  const handle = pinned ? (
    <span className="icon-btn pinned-mark" role="img" aria-label={t('pin.pinned')}>
      <Pin size={18} />
    </span>
  ) : (
    <button
      ref={sortable.setActivatorNodeRef}
      className="icon-btn drag-handle"
      aria-label={t('drag.folderHandle')}
      title={t('drag.folderHandle')}
      {...sortable.attributes}
      {...sortable.listeners}
    >
      <GripVertical size={18} />
    </button>
  );
  const highlight = sortable.isOver && draggingPlaylist;
  return (
    <div
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }}
      className={`dnd-row${sortable.isDragging ? ' dragging' : ''}${highlight ? ' drop-over' : ''}`}
    >
      {children(handle)}
    </div>
  );
}
