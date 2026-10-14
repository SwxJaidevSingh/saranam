/**
 * FormSubmissionViewer - Display form submission data in a readable format
 */
import { FileText, Calendar, User } from 'lucide-react';

export default function FormSubmissionViewer({ submission, schema }) {
  if (!submission || !submission.data) {
    return (
      <div className="text-muted-foreground text-center py-8">
        No submission data available
      </div>
    );
  }

  // Helper function to get field label from schema
  const getFieldLabel = (fieldId) => {
    if (!schema) return fieldId;

    let allFields = [];

    // Handle both single-page and multi-page forms
    if (schema.pages) {
      schema.pages.forEach(page => {
        allFields = [...allFields, ...page.fields];
      });
    } else if (schema.fields) {
      allFields = schema.fields;
    }

    const field = allFields.find(f => f.id === fieldId);
    return field?.label || fieldId;
  };

  // Helper function to format field value based on type
  const formatValue = (value) => {
    if (value === null || value === undefined || value === '') {
      return <span className="text-muted-foreground italic">Not provided</span>;
    }

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    if (Array.isArray(value)) {
      return value.join(', ');
    }

    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }

    return value.toString();
  };

  return (
    <div className="space-y-6">
      {/* Submission Metadata */}
      <div className="bg-secondary/30 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          {submission.submitted_at && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-muted-foreground">Submitted</div>
                <div className="font-medium text-foreground">
                  {new Date(submission.submitted_at).toLocaleString()}
                </div>
              </div>
            </div>
          )}

          {submission.submitted_by && (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-muted-foreground">Submitted By</div>
                <div className="font-medium text-foreground">{submission.submitted_by}</div>
              </div>
            </div>
          )}

          {submission.status && (
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-muted-foreground">Status</div>
                <div className="font-medium text-foreground capitalize">{submission.status}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Submission Data */}
      <div className="space-y-4">
        {Object.entries(submission.data).map(([fieldId, value]) => (
          <div key={fieldId} className="border-b border-border pb-3">
            <div className="text-sm font-medium text-muted-foreground mb-1">
              {getFieldLabel(fieldId)}
            </div>
            <div className="text-foreground whitespace-pre-wrap">
              {formatValue(value)}
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {Object.keys(submission.data).length === 0 && (
        <div className="text-center text-muted-foreground py-8">
          No data in this submission
        </div>
      )}
    </div>
  );
}
