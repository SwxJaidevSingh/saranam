import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Typography, Box, CircularProgress,
  FormControl, InputLabel, Select, MenuItem, TextField, Grid
} from '@mui/material';

const FileUploader = ({ onUpload, loading }) => {
  const [llmProvider, setLlmProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('');

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles?.length > 0) {
      onUpload(acceptedFiles[0], llmProvider, apiKey, modelName);
    }
  }, [onUpload, llmProvider, apiKey, modelName]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 1
  });

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        AI Configuration (Optional)
      </Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel id="llm-provider-label">AI Provider</InputLabel>
            <Select
              labelId="llm-provider-label"
              value={llmProvider}
              label="AI Provider"
              onChange={(e) => setLlmProvider(e.target.value)}
            >
              <MenuItem value="openai">OpenAI</MenuItem>
              <MenuItem value="anthropic">Anthropic (Claude)</MenuItem>
              <MenuItem value="gemini">Google Gemini</MenuItem>
              <MenuItem value="local">Local Model</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="API Key (Leave blank to use default)"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="API Key..."
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="Custom Model Name (Optional)"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            placeholder={llmProvider === 'openai' ? 'gpt-4o-mini' : llmProvider === 'anthropic' ? 'claude-3-haiku' : 'gemini-1.5-flash'}
          />
        </Grid>
      </Grid>

      <Typography variant="h6" gutterBottom>
        Upload File
      </Typography>
      <Box sx={{ border: '2px dashed #ccc', p: 4, textAlign: 'center', cursor: 'pointer', mb: 4 }} {...getRootProps()}>
        <input {...getInputProps()} />
        {loading ? (
          <CircularProgress />
        ) : isDragActive ? (
          <Typography>Drop the file here ...</Typography>
        ) : (
          <Typography>Drag and drop an appointment file here, or click to select files (CSV, XLSX, PDF)</Typography>
        )}
      </Box>
    </Box>
  );
};

export default FileUploader;
