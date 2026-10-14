/**
 * PatientJoinPage — public route patients open from WhatsApp/SMS/email.
 *
 * Reads ?token=<participant_token> from URL, joins the EnableX room as a
 * participant. No auth required (the token is the auth).
 *
 * URL: /teleconsult/join?token=<participant_token>
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Box, Typography, Button, IconButton, CircularProgress, Alert,
  Stack, Paper,
} from '@mui/material';
import {
  CallEnd, Mic, MicOff, Videocam, VideocamOff,
} from '@mui/icons-material';

const STREAM_OPT = { audio: true, video: true, data: true };
const RECONNECT_OPT = {
  allow_reconnect: true,
  number_of_attempts: 3,
  timeout_interval: 10000,
};

// StrictMode-safe join cache (see VideoCallRoom for context).
const ENX_JOINS = (typeof window !== 'undefined'
  ? (window.__enxJoinsPatient ||= new Map())
  : new Map());
const PENDING_DISCONNECTS = (typeof window !== 'undefined'
  ? (window.__enxPendingPatient ||= new Map())
  : new Map());

const useEnableXReady = () => {
  const [ready, setReady] = useState(!!window.EnxRtc);
  useEffect(() => {
    if (window.EnxRtc) { setReady(true); return undefined; }
    const start = Date.now();
    const t = setInterval(() => {
      if (window.EnxRtc) { setReady(true); clearInterval(t); }
      else if (Date.now() - start > 10000) { clearInterval(t); }
    }, 100);
    return () => clearInterval(t);
  }, []);
  return ready;
};

const PatientJoinPage = () => {
  const [token, setToken] = useState(null);
  const [error, setError] = useState(null);
  const [joining, setJoining] = useState(false);
  const [connected, setConnected] = useState(false);
  const [audioOn, setAudioOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [remoteCount, setRemoteCount] = useState(0);
  const [ready, setReady] = useState(false);

  const sdkReady = useEnableXReady();
  const localStreamRef = useRef(null);
  const roomRef = useRef(null);
  const remoteContainerRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (!t) {
      setError('Missing join token. Please check the link sent to you.');
    } else {
      setToken(t);
    }
  }, []);

  const startCall = () => {
    if (!sdkReady || !token) return;
    setReady(true);
  };

  useEffect(() => {
    if (!ready || !sdkReady || !token || joining || connected) return;

    const pending = PENDING_DISCONNECTS.get(token);
    if (pending) { clearTimeout(pending); PENDING_DISCONNECTS.delete(token); }
    const cached = ENX_JOINS.get(token);
    if (cached) {
      if (cached.inFlight) return;
      localStreamRef.current = cached.localStream;
      roomRef.current = cached.room;
      try { cached.localStream?.play?.('local-video'); } catch (_) {}
      (cached.remoteStreams || []).forEach(playRemote);
      setConnected(true);
      return;
    }

    ENX_JOINS.set(token, { inFlight: true });
    setJoining(true);
    try {
      const stream = window.EnxRtc.joinRoom(
        token,
        STREAM_OPT,
        (success, err) => {
          if (err) {
            ENX_JOINS.delete(token);
            setError(err.msg || err.message || 'Could not join the call.');
            setJoining(false);
            return;
          }
          try { success?.localStream?.play?.('local-video'); } catch (_) {}
          (success?.streams || []).forEach(playRemote);
          const room = success?.room;
          if (room) {
            roomRef.current = room;
            room.addEventListener?.('stream-subscribed', (e) => playRemote(e.stream));
            room.addEventListener?.('stream-removed', (e) => removeRemote(e.stream));
            room.addEventListener?.('user-connected', () => setRemoteCount(c => c + 1));
            room.addEventListener?.('user-disconnected', () => setRemoteCount(c => Math.max(0, c - 1)));
          }
          ENX_JOINS.set(token, {
            localStream: success?.localStream,
            room,
            remoteStreams: success?.streams || [],
          });
          setConnected(true);
          setJoining(false);
        },
        RECONNECT_OPT
      );
      localStreamRef.current = stream;
    } catch (e) {
      ENX_JOINS.delete(token);
      setError(e.message || String(e));
      setJoining(false);
    }
  }, [ready, sdkReady, token, joining, connected]);

  const playRemote = (s) => {
    if (!s || !remoteContainerRef.current) return;
    const id = `remote-${s.getID?.() || Math.random().toString(36).slice(2)}`;
    if (!document.getElementById(id)) {
      const div = document.createElement('div');
      div.id = id;
      div.style.cssText = `
        flex: 1 1 320px; min-width: 280px; aspect-ratio: 16/9;
        background:#000; border-radius:12px; overflow:hidden;
      `;
      remoteContainerRef.current.appendChild(div);
    }
    try { s.play?.(id); } catch (_) {}
    setRemoteCount(c => c + 1);
  };

  const removeRemote = (s) => {
    const id = `remote-${s?.getID?.() || ''}`;
    document.getElementById(id)?.remove();
    setRemoteCount(c => Math.max(0, c - 1));
  };

  useEffect(() => () => {
    if (!token) return;
    const t = setTimeout(() => {
      const cached = ENX_JOINS.get(token);
      if (cached) {
        try { cached.localStream?.disconnect?.(); } catch (_) {}
        try { cached.room?.disconnect?.(); } catch (_) {}
        ENX_JOINS.delete(token);
      }
      PENDING_DISCONNECTS.delete(token);
    }, 500);
    PENDING_DISCONNECTS.set(token, t);
  }, [token]);

  const toggleAudio = () => {
    const ls = localStreamRef.current;
    if (!ls) return;
    try { audioOn ? ls.muteAudio?.() : ls.unmuteAudio?.(); setAudioOn(!audioOn); } catch (_) {}
  };
  const toggleVideo = () => {
    const ls = localStreamRef.current;
    if (!ls) return;
    try { videoOn ? ls.muteVideo?.() : ls.unmuteVideo?.(); setVideoOn(!videoOn); } catch (_) {}
  };
  const endCall = () => {
    try { localStreamRef.current?.disconnect?.(); } catch (_) {}
    try { roomRef.current?.disconnect?.(); } catch (_) {}
    if (token) {
      ENX_JOINS.delete(token);
      const t = PENDING_DISCONNECTS.get(token);
      if (t) { clearTimeout(t); PENDING_DISCONNECTS.delete(token); }
    }
    setConnected(false);
  };

  if (error) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
        <Alert severity="error" sx={{ maxWidth: 480 }}>{error}</Alert>
      </Box>
    );
  }

  if (!ready) {
    return (
      <Box sx={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', p: 2, bgcolor: 'background.default',
      }}>
        <Paper elevation={3} sx={{ p: 4, borderRadius: 3, maxWidth: 480, textAlign: 'center' }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
            Saranam Palliative Care
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Your video consultation is ready. Click below to join — your camera and
            microphone will be requested.
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={startCall}
            disabled={!sdkReady || !token}
            sx={{ textTransform: 'none', borderRadius: 5, px: 4 }}
          >
            {sdkReady ? 'Join consultation' : 'Loading…'}
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#0a0a0a' }}>
      <Box sx={{
        px: 2, py: 1.5, color: 'white', bgcolor: 'rgba(0,0,0,0.6)',
        borderBottom: 1, borderColor: 'rgba(255,255,255,0.1)',
      }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Saranam Teleconsult — {remoteCount > 0 ? `${remoteCount + 1} connected` : 'Waiting for doctor…'}
        </Typography>
      </Box>

      <Box sx={{ flex: 1, p: 2, position: 'relative', overflow: 'hidden' }}>
        {(joining || !connected) && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
            <Stack alignItems="center" spacing={2}>
              <CircularProgress sx={{ color: 'white' }} />
              <Typography variant="body2" color="white">
                {joining ? 'Connecting…' : 'Initializing…'}
              </Typography>
            </Stack>
          </Box>
        )}
        <Box ref={remoteContainerRef} sx={{
          display: 'flex', flexWrap: 'wrap', gap: 2,
          height: '100%', alignContent: 'center', justifyContent: 'center',
        }} />
        <Box id="local-video" sx={{
          position: 'absolute', bottom: 80, right: 16,
          width: 180, aspectRatio: '16/9',
          bgcolor: '#000', borderRadius: 2, overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          border: '2px solid rgba(255,255,255,0.2)', zIndex: 4,
        }} />
      </Box>

      <Box sx={{
        px: 2, py: 1.5, display: 'flex', justifyContent: 'center',
        gap: 1.5, bgcolor: 'rgba(0,0,0,0.85)',
      }}>
        <IconButton
          onClick={toggleAudio}
          sx={{ bgcolor: audioOn ? 'rgba(255,255,255,0.15)' : 'error.main', color: 'white' }}
          disabled={!connected}
        >
          {audioOn ? <Mic /> : <MicOff />}
        </IconButton>
        <IconButton
          onClick={toggleVideo}
          sx={{ bgcolor: videoOn ? 'rgba(255,255,255,0.15)' : 'error.main', color: 'white' }}
          disabled={!connected}
        >
          {videoOn ? <Videocam /> : <VideocamOff />}
        </IconButton>
        <Button
          variant="contained" color="error" startIcon={<CallEnd />}
          onClick={endCall}
          sx={{ textTransform: 'none', borderRadius: 5, px: 3 }}
        >
          End
        </Button>
      </Box>
    </Box>
  );
};

export default PatientJoinPage;
