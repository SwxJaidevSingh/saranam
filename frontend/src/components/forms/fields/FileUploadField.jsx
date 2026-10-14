import { useState } from 'react';
import { Upload, X, File, Image, FileText, AlertCircle } from 'lucide-react';

/**
 * File Upload Field Component
 * Handles file uploads with validation and preview
 */
export default function FileUploadField({
  field,
  value,
  onChange,
  error,
  className = ''
}) {
  const [preview, setPreview] = useState(null);
  const [uploadError, setUploadError] = useState('');

  const maxSize = field.config?.maxSize || 10 * 1024 * 1024; // 10MB default
  const allowedTypes = field.config?.allowedTypes || [];
  const multiple = field.config?.multiple || false;

  const getFileIcon = (fileType) => {
    if (fileType.startsWith('image/')) return Image;
    if (fileType.includes('pdf')) return FileText;
    return File;
  };

  const validateFile = (file) => {
    // Check file size
    if (file.size > maxSize) {
      return `File size exceeds ${(maxSize / 1024 / 1024).toFixed(1)}MB limit`;
    }

    // Check file type
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
      return `File type ${file.type} is not allowed`;
    }

    return null;
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    setUploadError('');

    if (files.length === 0) return;

    // Validate each file
    for (const file of files) {
      const validationError = validateFile(file);
      if (validationError) {
        setUploadError(validationError);
        return;
      }
    }

    // Handle preview for images
    if (files[0] && files[0].type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(files[0]);
    } else {
      setPreview(null);
    }

    // Pass files to parent
    onChange(multiple ? files : files[0]);
  };

  const handleRemove = () => {
    setPreview(null);
    setUploadError('');
    onChange(null);
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  return (
    <div className={className}>
      {!value ? (
        <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary-400 transition-colors">
          <label
            htmlFor={field.id}
            className="cursor-pointer flex flex-col items-center gap-3"
          >
            <div className="w-12 h-12 bg-primary-500/10 dark:bg-primary-500/20 rounded-full flex items-center justify-center">
              <Upload className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {allowedTypes.length > 0
                  ? `Accepted: ${allowedTypes.join(', ')}`
                  : 'Any file type'}
              </p>
              <p className="text-xs text-muted-foreground">
                Max size: {(maxSize / 1024 / 1024).toFixed(0)}MB
              </p>
            </div>
          </label>
          <input
            id={field.id}
            type="file"
            onChange={handleFileChange}
            multiple={multiple}
            accept={allowedTypes.join(',')}
            className="hidden"
          />
        </div>
      ) : (
        <div className="border-2 border-border rounded-lg p-4">
          {preview ? (
            <div className="space-y-3">
              <img
                src={preview}
                alt="Preview"
                className="w-full h-48 object-cover rounded"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Image className="w-5 h-5 text-muted-foreground/70" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {value.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(value.size)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="p-2 text-danger-600 hover:bg-danger-50 rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {(() => {
                  const FileIcon = getFileIcon(value.type || '');
                  return <FileIcon className="w-8 h-8 text-muted-foreground/70" />;
                })()}
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {value.name || 'Uploaded file'}
                  </p>
                  {value.size && (
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(value.size)}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemove}
                className="p-2 text-danger-600 hover:bg-danger-50 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      )}

      {(uploadError || error) && (
        <div className="flex items-start gap-2 mt-2 p-3 bg-danger-500/10 rounded-lg">
          <AlertCircle className="w-4 h-4 text-danger-600 dark:text-danger-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-danger-600 dark:text-danger-400">{uploadError || error}</p>
        </div>
      )}
    </div>
  );
}
