import { useDraggable } from '@dnd-kit/core';
import {
  Type,
  Hash,
  Mail,
  Calendar,
  List,
  AlignLeft,
  CheckSquare,
  Circle,
  Star,
  Upload,
  Minus,
  Clock,
  Link,
  Phone,
  MapPin,
  Activity,
  AlertTriangle,
  ClipboardList,
  UserCheck,
  Shield,
} from 'lucide-react';

const FIELD_TYPES = [
  {
    type: 'text',
    label: 'Text Input',
    icon: Type,
    description: 'Single line text input',
  },
  {
    type: 'numeric',
    label: 'Numeric',
    icon: Hash,
    description: 'Numeric input (integers or decimals)',
  },
  {
    type: 'email',
    label: 'Email',
    icon: Mail,
    description: 'Email address input',
  },
  {
    type: 'date',
    label: 'Date',
    icon: Calendar,
    description: 'Date picker',
  },
  {
    type: 'time',
    label: 'Time',
    icon: Clock,
    description: 'Time picker',
  },
  {
    type: 'select',
    label: 'Select',
    icon: List,
    description: 'Dropdown selection',
  },
  {
    type: 'textarea',
    label: 'Text Area',
    icon: AlignLeft,
    description: 'Multi-line text input',
  },
  {
    type: 'checkbox',
    label: 'Checkbox',
    icon: CheckSquare,
    description: 'Single checkbox',
  },
  {
    type: 'radio',
    label: 'Radio',
    icon: Circle,
    description: 'Radio button group',
  },
  {
    type: 'linearScale',
    label: 'Linear Scale',
    icon: Star,
    description: 'Rating scale or star rating',
  },
  {
    type: 'painScale',
    label: 'Pain Scale',
    icon: Activity,
    description: '0-10 pain scale with emoji faces',
  },
  {
    type: 'severityRating',
    label: 'Severity Rating',
    icon: AlertTriangle,
    description: 'Color-coded severity levels (None to Critical)',
  },
  {
    type: 'symptomChecklist',
    label: 'Symptom Checklist',
    icon: ClipboardList,
    description: 'Multi-symptom selection with severity sub-ratings',
  },
  {
    type: 'functionalStatus',
    label: 'Functional Status',
    icon: UserCheck,
    description: 'ECOG, Karnofsky, or ADL performance scales',
  },
  {
    type: 'riskScoreDisplay',
    label: 'Risk Score',
    icon: Shield,
    description: 'Real-time calculated risk score display',
  },
  {
    type: 'file',
    label: 'File Upload',
    icon: Upload,
    description: 'File upload with validation',
  },
  {
    type: 'url',
    label: 'URL',
    icon: Link,
    description: 'Website URL input',
  },
  {
    type: 'phone',
    label: 'Phone Number',
    icon: Phone,
    description: 'Phone number with country code',
  },
  {
    type: 'geoLocation',
    label: 'Geo-Location / Address',
    icon: MapPin,
    description: 'Capture GPS coordinates, IP address, and manual address',
  },
  {
    type: 'section',
    label: 'Section Header',
    icon: Minus,
    description: 'Visual section divider',
  },
];

function DraggableFieldType({ fieldType }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette-${fieldType.type}`,
    data: {
      type: fieldType.type,
      fromPalette: true,
    },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  const Icon = fieldType.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      title={`${fieldType.label} - ${fieldType.description}`}
      className="bg-card border-2 border-border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-primary-400 hover:shadow-lg hover:scale-105 transition-all flex items-center justify-center group"
    >
      <div className="p-2 bg-primary-50 rounded-lg group-hover:bg-primary-100 transition-colors">
        <Icon className="w-6 h-6 text-primary-600" />
      </div>
    </div>
  );
}

export default function FieldPalette() {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-semibold text-foreground mb-2">Field Types</h3>
        <p className="text-sm text-muted-foreground">Drag fields to the canvas to add them</p>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2">
        {FIELD_TYPES.map((fieldType) => (
          <DraggableFieldType key={fieldType.type} fieldType={fieldType} />
        ))}
      </div>
    </div>
  );
}
