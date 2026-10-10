'use client';

import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconGrip } from './Icons';

/** Lista reordenable arrastrando el ícono ⋮⋮ (funciona con dedo y mouse). */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  render,
  disabled,
}: {
  items: T[];
  onReorder: (items: T[]) => void;
  render: (item: T, handle: React.ReactNode) => React.ReactNode;
  disabled?: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    onReorder(arrayMove(items, from, to));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy} disabled={disabled}>
        {items.map((item) => (
          <SortableRow key={item.id} id={item.id} disabled={disabled}>
            {(handle) => render(item, handle)}
          </SortableRow>
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, disabled, children }: { id: string; disabled?: boolean; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : undefined, position: 'relative' as const };
  const handle = disabled ? null : (
    <button type="button" className="p-2 -ml-1 text-sand-500 touch-none cursor-grab active:cursor-grabbing" aria-label="Arrastrar para ordenar" {...attributes} {...listeners}>
      <IconGrip />
    </button>
  );
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'opacity-80 shadow-2xl' : ''}>
      {children(handle)}
    </div>
  );
}
