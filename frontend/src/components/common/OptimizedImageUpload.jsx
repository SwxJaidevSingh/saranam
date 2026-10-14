import React, { useState } from 'react';
import { Upload, X, RefreshCw } from 'lucide-react';
import mediaApi from '../../api/media';

export default function OptimizedImageUpload({ onUploadSuccess, className = "" }) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadedData, setUploadedData] = useState(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processUpload(e.dataTransfer.files[0]);
    }
  };

  const handleChange = async (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      await processUpload(e.target.files[0]);
    }
  };

  const processUpload = async (file) => {
    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/heic', 'image/heif'];
    if (!validTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.heic') && !file.name.toLowerCase().endsWith('.heif')) {
      setError('Only PNG, JPEG, WEBP, and HEIC/HEIF images are accepted.');
      return;
    }

    // Validate size (10 MB max)
    if (file.size > 10 * 1024 * 1024) {
      setError('File is too large (maximum size is 10MB).');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const data = await mediaApi.uploadImage(file);
      setUploadedData(data);
      if (onUploadSuccess) {
        onUploadSuccess(data);
      }
    } catch (err) {
      console.error('Image upload failed:', err);
      setError(err.response?.data?.error || 'Failed to upload image. Please check your connection and try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`p-6 border-2 border-dashed rounded-xl transition-all ${
      dragActive ? 'border-primary bg-primary/5' : 'border-border bg-card'
    } ${className}`}>
      <div 
        onDragEnter={handleDrag} 
        onDragOver={handleDrag} 
        onDragLeave={handleDrag} 
        onDrop={handleDrop}
        className="flex flex-col items-center justify-center min-h-[160px] cursor-pointer relative"
      >
        <input 
          type="file" 
          id="media-file-upload" 
          accept="image/*" 
          onChange={handleChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          disabled={uploading}
        />
        
        {uploading ? (
          <div className="flex flex-col items-center gap-3 text-center z-0">
            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm font-medium text-foreground">Uploading & converting to AVIF format...</p>
            <p className="text-xs text-muted-foreground">This may take a moment to compress.</p>
          </div>
        ) : uploadedData ? (
          <div className="flex flex-col items-center gap-3 w-full text-center z-20">
            <div className="w-32 h-32 rounded-lg overflow-hidden border border-border shadow-soft relative group">
              <img 
                src={uploadedData.optimized_url} 
                alt="Optimized preview" 
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-1 right-1 bg-black/75 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                webp
              </span>
            </div>
            
            <div className="max-w-xs md:max-w-md">
              <p className="text-xs text-emerald-600 font-semibold mb-0.5">✓ Upload & AVIF Storage Successful</p>
              <p className="text-[10px] text-muted-foreground font-mono truncate select-all px-2 py-0.5 bg-muted rounded border border-border">
                {uploadedData.optimized_url}
              </p>
            </div>

            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setUploadedData(null);
              }}
              className="text-xs text-red-500 hover:text-red-700 underline font-medium flex items-center gap-1 mt-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear and upload another</span>
            </button>
          </div>
        ) : (
          <div className="text-center pointer-events-none flex flex-col items-center z-0">
            <Upload className="h-10 w-10 text-muted-foreground/60 mb-2" />
            <p className="text-sm font-medium text-foreground">Drag and drop your image here, or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">Accepts PNG, JPEG, JPG, WEBP, HEIC/HEIF (Max 10MB)</p>
          </div>
        )}

        {error && (
          <div className="text-xs text-red-500 font-medium mt-3 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full flex items-center gap-1.5 z-20">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
