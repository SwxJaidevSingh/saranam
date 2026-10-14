/**
 * PreCallCheck — verify camera + mic before joining the EnableX iframe.
 * Cuts the "I joined but no video" support tickets.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Box, Typography, Button, Paper, Alert, CircularProgress, Stack,
} from '@mui/material';
import { Videocam, Mic, CheckCircle, Error as ErrorIcon } from '@mui/icons-material';

const PreCallCheck = ({ onReady, onCancel }) => {
  const videoRef = useRef(null);
  const [status, setStatus] = useState('requesting'); // requesting | ok | denied
  const [error, setError] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true, audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setStatus('ok');

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);
        const buf = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(buf);
          const avg = buf.reduce((s, v) => s + v, 0) / buf.length;
          setAudioLevel(Math.min(100, Math.round(avg)));
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch (err) {
        setStatus('denied');
        setError(err.message);
      }
    };
    start();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    };
  }, []);

  const handleJoin = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    onReady();
  };

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', bgcolor: 'background.default', p: 2,
    }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 3, width: '100%', maxWidth: 640 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          Pre-call check
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Make sure your camera and microphone work before joining the call.
        </Typography>

        <Box sx={{
          width: '100%', aspectRatio: '16 / 9', bgcolor: 'black',
          borderRadius: 2, overflow: 'hidden', position: 'relative', mb: 2,
        }}>
          {status === 'requesting' && (
            <Box sx={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: 'white',
            }}>
              <CircularProgress sx={{ color: 'white' }} />
            </Box>
          )}
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </Box>

        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Videocam fontSize="small" color={status === 'ok' ? 'success' : 'disabled'} />
            <Typography variant="body2">
              Camera {status === 'ok' ? 'OK' : status === 'denied' ? 'blocked' : '...'}
            </Typography>
            {status === 'ok' && <CheckCircle color="success" fontSize="small" />}
            {status === 'denied' && <ErrorIcon color="error" fontSize="small" />}
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Mic fontSize="small" color={status === 'ok' ? 'success' : 'disabled'} />
            <Typography variant="body2">Mic level</Typography>
            <Box sx={{
              width: 100, height: 6, bgcolor: 'grey.300', borderRadius: 3, overflow: 'hidden',
            }}>
              <Box sx={{
                width: `${audioLevel}%`, height: '100%', bgcolor: 'success.main',
                transition: 'width .1s',
              }} />
            </Box>
          </Stack>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Camera/mic access blocked. Please allow permissions and refresh. Details: {error}
          </Alert>
        )}

        <Stack direction="row" spacing={2} justifyContent="flex-end">
          {onCancel && (
            <Button variant="text" onClick={onCancel} sx={{ textTransform: 'none' }}>
              Cancel
            </Button>
          )}
          <Button
            variant="contained"
            onClick={handleJoin}
            disabled={status !== 'ok'}
            sx={{ textTransform: 'none' }}
          >
            I'm ready — Join call
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
};

export default PreCallCheck;
