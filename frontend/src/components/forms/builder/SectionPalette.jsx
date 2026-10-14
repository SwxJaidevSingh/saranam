import { useState, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import {
  Layers,
  ChevronDown,
  ChevronRight,
  Heart,
  ClipboardCheck,
  Users,
  AlertCircle,
  GripVertical,
} from 'lucide-react';
import { riskApi } from '../../../api/risk';

const CATEGORY_ICONS = {
  vitals: Heart,
  assessment: ClipboardCheck,
  social: Users,
  physiotherapy: Heart,
  default: Layers,
};

const CATEGORY_LABELS = {
  vitals: 'Vital Signs',
  assessment: 'Clinical Assessment',
  social: 'Social & Support',
  physiotherapy: 'Physiotherapy',
};

function DraggableField({ field, sectionName, index }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `section-field-${sectionName}-${index}`,
    data: {
      type: 'field',
      field: field,
      fromSectionPalette: true,
      fromIndividualField: true,
    },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="flex items-center gap-2 text-xs bg-card px-2 py-1.5 rounded border border-border hover:border-primary-400 hover:shadow cursor-grab active:cursor-grabbing transition-all"
    >
      <GripVertical className="w-3 h-3 text-muted-foreground/70 flex-shrink-0" />
      <span className="w-4 h-4 flex items-center justify-center bg-secondary rounded text-muted-foreground font-medium flex-shrink-0">
        {index + 1}
      </span>
      <span className="font-medium text-foreground flex-1 truncate">
        {field.label}
      </span>
      <span className="px-1.5 py-0.5 bg-primary-100 text-primary-700 rounded text-xs font-medium flex-shrink-0">
        {field.type}
      </span>
      {field.required && (
        <span className="text-red-500 font-bold flex-shrink-0">*</span>
      )}
    </div>
  );
}

function DraggableSection({ section }) {
  const [expanded, setExpanded] = useState(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `section-${section.id}`,
    data: {
      type: 'section',
      section: section,
      fromSectionPalette: true,
    },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  const CategoryIcon = CATEGORY_ICONS[section.category] || CATEGORY_ICONS.default;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-card border-2 border-border rounded-lg overflow-hidden hover:border-primary-400 hover:shadow-lg transition-all"
    >
      {/* Section Header */}
      <div className="p-3 bg-gradient-to-r from-primary-50 to-card dark:from-primary-900/20 dark:to-card">
        <div className="flex items-start gap-2">
          {/* Drag Handle */}
          <div
            {...listeners}
            {...attributes}
            className="p-1 cursor-grab active:cursor-grabbing hover:bg-card rounded transition-colors flex-shrink-0"
            title="Drag to add entire section"
          >
            <GripVertical className="w-4 h-4 text-muted-foreground/70" />
          </div>

          {/* Section Content - Clickable to expand */}
          <div
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 flex-1 cursor-pointer min-w-0"
          >
            <div className="p-2 bg-primary-100 rounded-lg flex-shrink-0">
              <CategoryIcon className="w-5 h-5 text-primary-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-foreground text-sm truncate">
                {section.name}
              </h4>
              <p className="text-xs text-muted-foreground">
                {section.fields?.length || 0} fields
                {section.is_system && (
                  <span className="ml-2 px-1.5 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded text-xs">
                    System
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Expand Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="p-1 hover:bg-card rounded transition-colors flex-shrink-0"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </div>
        {section.description && (
          <p className="text-xs text-muted-foreground mt-1 ml-7">{section.description}</p>
        )}
      </div>

      {/* Expanded Field List */}
      {expanded && (
        <div className="px-3 pb-3 bg-secondary border-t border-border">
          <p className="text-xs text-muted-foreground mt-2 mb-1 font-medium">
            Drag individual fields or the entire section above
          </p>
          <div className="mt-2 space-y-1">
            {section.fields?.map((field, idx) => (
              <DraggableField
                key={idx}
                field={field}
                sectionName={section.name}
                index={idx}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SectionPalette() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    loadSections();
  }, []);

  const loadSections = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await riskApi.getFieldSections();
      if (response.success) {
        setSections(response.sections || []);
      } else {
        setError(response.error || 'Failed to load sections');
      }
    } catch (err) {
      console.error('Error loading field sections:', err);
      setError('Failed to load field sections');
    } finally {
      setLoading(false);
    }
  };

  // Filter sections based on selected category
  const filteredSections =
    selectedCategory === 'all'
      ? sections
      : sections.filter((s) => s.category === selectedCategory);

  // Get unique categories for filter buttons
  const categories = ['all', ...new Set(sections.map((s) => s.category).filter(Boolean))];

  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="font-semibold text-foreground">Field Sections</h3>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <h3 className="font-semibold text-foreground">Field Sections</h3>
        <div className="bg-red-500/10 border border-red-200 dark:border-red-400/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button
            onClick={loadSections}
            className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="font-semibold text-foreground">Field Sections</h3>
        <div className="bg-secondary border border-border rounded-lg p-6 text-center">
          <Layers className="w-12 h-12 text-muted-foreground/70 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No field sections available</p>
          <p className="text-xs text-muted-foreground mt-1">
            Run the seed script to populate pre-defined sections
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-semibold text-foreground mb-2">Field Sections</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Drag entire sections to quickly build forms
        </p>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-3">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                selectedCategory === category
                  ? 'bg-primary-600 text-white'
                  : 'bg-secondary text-foreground hover:bg-accent'
              }`}
            >
              {category === 'all' ? 'All' : CATEGORY_LABELS[category] || category}
            </button>
          ))}
        </div>
      </div>

      {/* Sections List */}
      <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
        {filteredSections.length === 0 ? (
          <div className="bg-secondary border border-border rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground">No sections in this category</p>
          </div>
        ) : (
          filteredSections.map((section) => (
            <DraggableSection key={section.id} section={section} />
          ))
        )}
      </div>

      {/* Info Footer */}
      <div className="bg-blue-500/10 border border-blue-200 dark:border-blue-400/30 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-600 dark:text-blue-400">
            <p className="font-medium">Tip:</p>
            <p className="mt-1">
              Drag entire sections or expand them to drag individual fields. All fields
              retain their pre-configured settings, including clinical mappings and
              validation rules.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
