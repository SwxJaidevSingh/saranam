import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Edit,
  Trash2,
  Copy,
  Type,
  Hash,
  Mail,
  Calendar,
  List,
  AlignLeft,
  CheckSquare,
  Circle,
} from 'lucide-react';
import clsx from 'clsx';

const FIELD_ICONS = {
  text: Type,
  number: Hash,
  email: Mail,
  date: Calendar,
  select: List,
  textarea: AlignLeft,
  checkbox: CheckSquare,
  radio: Circle,
};

function SortableFieldItem({ field, onEdit, onDelete, onDuplicate, isSelected }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = FIELD_ICONS[field.type] || Type;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'bg-card border-2 rounded-lg p-4 group hover:border-primary-400 transition-all',
        isSelected ? 'border-primary-500 ring-2 ring-primary-200' : 'border-border'
      )}
    >
      <div className="flex items-center gap-3">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="text-muted-foreground/70 hover:text-muted-foreground cursor-grab active:cursor-grabbing flex-shrink-0"
        >
          <GripVertical className="w-5 h-5" />
        </button>

        {/* Field Icon */}
        <div className="p-2 bg-secondary rounded flex-shrink-0">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>

        {/* Field Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-foreground truncate">
              {field.label || 'Untitled Field'}
            </h4>
            {field.required && (
              <span className="text-xs px-2 py-0.5 bg-danger-100 text-danger-700 rounded">
                Required
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground capitalize">
            {field.type} field
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(field)}
            className="p-2 text-muted-foreground hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
            title="Edit field"
          >
            <Edit className="w-4 h-4" />
          </button>
          {onDuplicate && (
            <button
              onClick={() => onDuplicate(field)}
              className="p-2 text-muted-foreground hover:text-secondary-600 hover:bg-secondary-50 rounded transition-colors"
              title="Duplicate field"
            >
              <Copy className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onDelete(field.id)}
            className="p-2 text-muted-foreground hover:text-danger-600 hover:bg-danger-50 rounded transition-colors"
            title="Delete field"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FormCanvas({ fields, onEdit, onDelete, onDuplicate, selectedFieldId }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'form-canvas',
  });

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'min-h-[400px] border-2 border-dashed rounded-xl p-6 transition-all',
        isOver ? 'border-primary-500 bg-primary-50' : 'border-border bg-secondary'
      )}
    >
      {fields.length === 0 ? (
        <div className="flex items-center justify-center h-[400px] text-center">
          <div>
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
              <Type className="w-8 h-8 text-muted-foreground/70" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No fields added yet
            </h3>
            <p className="text-muted-foreground text-sm max-w-sm">
              Drag field types from the palette on the left to start building your form
            </p>
          </div>
        </div>
      ) : (
        <SortableContext
          items={fields.map((f) => f.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {fields.map((field) => (
              <SortableFieldItem
                key={field.id}
                field={field}
                onEdit={onEdit}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                isSelected={selectedFieldId === field.id}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
}
