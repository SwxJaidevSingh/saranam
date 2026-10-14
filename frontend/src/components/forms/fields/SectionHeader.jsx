import { Minus } from 'lucide-react';

/**
 * Section Header Component
 * Non-input element that displays a section title and description
 */
export default function SectionHeader({ field }) {
  return (
    <div className="border-t-2 border-border pt-6 mt-6">
      <div className="flex items-center gap-3 mb-2">
        <Minus className="w-6 h-6 text-primary-600 dark:text-primary-400" />
        <h3 className="text-xl font-semibold text-foreground">
          {field.label}
        </h3>
      </div>
      {field.description && (
        <p className="text-muted-foreground ml-9">
          {field.description}
        </p>
      )}
    </div>
  );
}
