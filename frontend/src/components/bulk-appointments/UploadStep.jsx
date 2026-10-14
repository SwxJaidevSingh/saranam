/**
 * Upload Step - File upload and initial processing
 */
import React, { useState, useRef } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Alert } from '../ui/alert';
import { FileSpreadsheet, Upload, Download, Loader2 } from 'lucide-react';
import pureLogicBulkApi from '../../api/pureLogicBulk';

const UploadStep = ({ onNext, onError }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (selectedFile) => {
    // Validate file type
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!allowedTypes.includes(selectedFile.type) &&
        !selectedFile.name.endsWith('.csv') &&
        !selectedFile.name.endsWith('.xlsx')) {
      onError('Please upload a CSV or XLSX file');
      return;
    }

    setFile(selectedFile);
    onError(null); // Clear any previous errors
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await pureLogicBulkApi.downloadTemplate();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'bulk_appointment_template.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      onError('Failed to download template: ' + error.message);
    }
  };

  const handleUploadAndProcess = async () => {
    if (!file) {
      onError('Please select a file first');
      return;
    }

    try {
      setUploading(true);
      onError(null);

      // Step 1: Upload file
      const uploadResponse = await pureLogicBulkApi.uploadFile(file);
      const sessionId = uploadResponse.session_id;

      setUploading(false);
      setProcessing(true);

      // Step 2: Process and validate
      const processResponse = await pureLogicBulkApi.processFile(sessionId);

      // Move to next step with session data
      onNext({
        session: {
          id: sessionId,
          ...uploadResponse
        },
        statistics: processResponse.statistics
      });

    } catch (error) {
      setUploading(false);
      setProcessing(false);
      onError('Upload failed: ' + (error.response?.data?.error || error.message));
    }
  };

  return (
    <div className="space-y-6">
      {/* File Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          dragActive
            ? 'border-primary bg-primary/5'
            : file
            ? 'border-green-500 bg-green-50'
            : 'border-border hover:border-primary/50'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !file && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {file ? (
          <div>
            <FileSpreadsheet className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">{file.name}</p>
            <p className="text-sm text-muted-foreground mb-4">
              {(file.size / 1024).toFixed(2)} KB
            </p>
            <Button
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
              }}
            >
              Choose Different File
            </Button>
          </div>
        ) : (
          <div>
            <Upload className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">Drag & Drop CSV/XLSX File</p>
            <p className="text-sm text-muted-foreground mb-4">
              or click to browse files
            </p>
            <Button variant="outline">Browse Files</Button>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          className="flex-1"
          onClick={handleDownloadTemplate}
        >
          <Download className="h-4 w-4 mr-2" />
          Download Template
        </Button>
        <Button
          className="flex-1"
          onClick={handleUploadAndProcess}
          disabled={!file || uploading || processing}
        >
          {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {uploading ? 'Uploading...' : processing ? 'Processing...' : 'Upload & Process'}
        </Button>
      </div>

      {/* Instructions */}
      <Alert>
        <FileSpreadsheet className="h-4 w-4" />
        <div className="ml-2">
          <p className="font-medium mb-2">CSV Format Requirements:</p>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            <li>
              <strong>Required columns:</strong> patient_name, patient_phone, provider_name,
              appointment_date, appointment_time
            </li>
            <li>
              <strong>Optional columns:</strong> patient_email, patient_dob, duration_minutes,
              appointment_type, chief_complaint, notes
            </li>
            <li>
              <strong>Date format:</strong> YYYY-MM-DD (e.g., 2026-03-20)
            </li>
            <li>
              <strong>Time format:</strong> HH:MM (24-hour format, e.g., 14:30)
            </li>
          </ul>
        </div>
      </Alert>

      {/* Processing Info */}
      {(uploading || processing) && (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <div className="ml-2">
            <p className="font-medium">
              {uploading ? 'Uploading file...' : 'Processing appointments...'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {uploading
                ? 'Please wait while we upload your file'
                : 'Validating appointments and detecting conflicts'}
            </p>
          </div>
        </Alert>
      )}
    </div>
  );
};

export default UploadStep;
