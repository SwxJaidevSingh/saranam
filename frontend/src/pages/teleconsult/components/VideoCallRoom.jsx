/**
 * VideoCallRoom — embeds the EnableX Web SDK directly inside the platform.
 *
 * EnableX has no hosted iframe URL and no npm package for web. We self-host
 * the EnxRtc.js SDK from /public/vendor/EnxRtc.js (loaded as a global via
 * index.html), then call window.EnxRtc.joinRoom(token, ...) here.
 *
 * SDK ref: https://developer.enablex.io/docs/references/sdks/video-sdk/web-sdk/
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, IconButton, CircularProgress, Alert,
  Stack, Chip, Tooltip, Snackbar,
} from '@mui/material';
import {
  CallEnd, ContentCopy, ArrowBack, FiberManualRecord,
  Mic, MicOff, Videocam, VideocamOff, OpenInNew,
} from '@mui/icons-material';
import teleconsultApi from '../../../api/teleconsult';
import PreCallCheck from './PreCallCheck';

const STREAM_OPT = { audio: true, video: true, data: true };
const RECONNECT_OPT = {
  allow_reconnect: true,
  number_of_attempts: 3,
  timeout_interval: 10000,
};

// Module-level cache so React StrictMode double-mount in dev doesn't
// disconnect-then-rejoin (which burns the EnableX socket and triggers 1161
// "Server connection failure"). Key = session id.
const ENX_JOINS = (typeof window !== 'undefined'
  ? (window.__enxJoins ||= new Map())
  : new Map());
const PENDING_DISCONNECTS = (typeof window !== 'undefined'
  ? (window.__enxPendingDisconnects ||= new Map())
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

const VideoCallRoom = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmedReady, setConfirmedReady] = useState(false);
  const [endingCall, setEndingCall] = useState(false);
  const [snackbar, setSnackbar] = useState(null);
  const [joining, setJoining] = useState(false);
  const [connected, setConnected] = useState(false);
  const [audioOn, setAudioOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [remoteCount, setRemoteCount] = useState(0);

  const sdkReady = useEnableXReady();

  const localStreamRef = useRef(null);
  const roomRef = useRef(null);
  const remoteContainerRef = useRef(null);

  // ----- load session -----
  useEffect(() => {
    (async () => {
      try {
        const data = await teleconsultApi.getSession(id, { includeTokens: true });
        setSession(data);
      } catch (e) {
        setError(e?.response?.data?.error || e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // ----- join EnableX room -----
  const join = useCallback(() => {
    if (!sdkReady || !session?.moderator_token) return;

    // Cancel any pending disconnect from a previous (StrictMode) unmount
    const pending = PENDING_DISCONNECTS.get(session.id);
    if (pending) {
      clearTimeout(pending);
      PENDING_DISCONNECTS.delete(session.id);
    }
    // If we already joined / are joining this session, bail.
    // The IN-FLIGHT marker is critical: it's set the instant joinRoom is
    // called, so a StrictMode remount BEFORE the success callback also
    // skips re-calling joinRoom (which would otherwise burn the token and
    // trigger EnableX 1161 "Server connection failure").
    const cached = ENX_JOINS.get(session.id);
    if (cached) {
      if (cached.inFlight) {
        return; // first mount's joinRoom hasn't returned yet
      }
      localStreamRef.current = cached.localStream;
      roomRef.current = cached.room;
      setConnected(true);
      try { cached.localStream?.play?.('local-video'); } catch (_) {}
      (cached.remoteStreams || []).forEach((s) => playRemote(s));
      return;
    }
    if (joining || connected || roomRef.current) return;

    // Reserve the slot BEFORE calling joinRoom — see comment above.
    ENX_JOINS.set(session.id, { inFlight: true });
    setJoining(true);
    // Decode token + log host so we can debug 1161 (signaling unreachable
    // vs. server rejection). EnableX tokens are base64(JSON) — not signed
    // JWTs — so this is safe and only meant for the doctor's own browser.
    try {
      const decoded = JSON.parse(window.atob(session.moderator_token));
      // eslint-disable-next-line no-console
      console.log('[teleconsult] joining EnableX room', {
        host: decoded.host,
        gateway: decoded.gateway,
        roomId: decoded.roomMeta?._id,
        roomName: decoded.roomMeta?.name,
        serviceId: decoded.roomMeta?.service_id,
      });
      // Active connectivity probe so we can tell network blockage apart
      // from server rejection. Wraps a 5s timeout.
      if (decoded.host) {
        const wsUrl = `wss://${decoded.host}/socket.io/?EIO=4&transport=websocket`;
        try {
          const probe = new WebSocket(wsUrl);
          const t = setTimeout(() => {
            // eslint-disable-next-line no-console
            console.warn('[teleconsult] signaling probe timed out — likely network/firewall blocked', wsUrl);
            try { probe.close(); } catch (_) {}
          }, 5000);
          probe.onopen = () => {
            // eslint-disable-next-line no-console
            console.log('[teleconsult] signaling probe OPENED — host reachable', wsUrl);
            clearTimeout(t); try { probe.close(); } catch (_) {}
          };
          probe.onerror = (e) => {
            // eslint-disable-next-line no-console
            console.error('[teleconsult] signaling probe ERROR', wsUrl, e);
            clearTimeout(t);
          };
          probe.onclose = (e) => {
            // eslint-disable-next-line no-console
            console.log('[teleconsult] signaling probe closed', { code: e.code, reason: e.reason });
          };
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('[teleconsult] signaling probe threw', e);
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[teleconsult] could not decode moderator token', e);
    }

    try {
      const stream = window.EnxRtc.joinRoom(
        session.moderator_token,
        STREAM_OPT,
        (success, err) => {
          if (err) {
            // eslint-disable-next-line no-console
            console.error('[teleconsult] EnableX joinRoom callback error', err);
            ENX_JOINS.delete(session.id);
            setError(`Join failed: ${err.msg || err.message || JSON.stringify(err)}`);
            setJoining(false);
            return;
          }
          // Local preview
          try { success?.localStream?.play?.('local-video'); } catch (_) {}
          // Pre-existing remote streams
          (success?.streams || []).forEach(playRemote);
          // Subscribe to room events
          const room = success?.room;
          if (room) {
            roomRef.current = room;
            room.addEventListener?.('stream-subscribed', (e) => playRemote(e.stream));
            room.addEventListener?.('stream-removed', (e) => removeRemote(e.stream));
            room.addEventListener?.('user-disconnected', () => bumpRemoteCount(-1));
            room.addEventListener?.('user-connected', () => bumpRemoteCount(1));
          }
          ENX_JOINS.set(session.id, {
            localStream: success?.localStream,
            room: roomRef.current,
            remoteStreams: success?.streams || [],
          });
          setConnected(true);
          setJoining(false);
        },
        RECONNECT_OPT
      );
      localStreamRef.current = stream;
    } catch (e) {
      ENX_JOINS.delete(session.id);
      setError(`SDK error: ${e.message || e}`);
      setJoining(false);
    }
  }, [sdkReady, session, joining, connected]);

  const playRemote = (s) => {
    if (!s || !remoteContainerRef.current) return;
    const id = `remote-${s.getID?.() || Math.random().toString(36).slice(2)}`;
    if (!document.getElementById(id)) {
      const div = document.createElement('div');
      div.id = id;
      div.className = 'enx-remote';
      div.style.cssText = `
        flex: 1 1 320px; min-width: 280px; aspect-ratio: 16 / 9;
        background: #000; border-radius: 12px; overflow: hidden; position: relative;
      `;
      remoteContainerRef.current.appendChild(div);
    }
    try { s.play?.(id); } catch (_) {}
    bumpRemoteCount(1);
  };

  const removeRemote = (s) => {
    const id = `remote-${s?.getID?.() || ''}`;
    const el = document.getElementById(id);
    if (el) el.remove();
    bumpRemoteCount(-1);
  };

  const bumpRemoteCount = (delta) =>
    setRemoteCount(c => Math.max(0, c + delta));

  // ----- auto-join after pre-call check -----
  useEffect(() => {
    if (confirmedReady && sdkReady && session && !connected && !joining) {
      join();
    }
  }, [confirmedReady, sdkReady, session, connected, joining, join]);

  // ----- cleanup on unmount -----
  // Defer disconnect by 500ms so StrictMode's double-mount in dev doesn't
  // tear down the active SDK session. The next mount will cancel this
  // pending timeout and reuse the cached room.
  useEffect(() => {
    return () => {
      const sid = session?.id;
      if (!sid) return;
      const t = setTimeout(() => {
        const cached = ENX_JOINS.get(sid);
        if (cached) {
          try { cached.localStream?.disconnect?.(); } catch (_) {}
          try { cached.room?.disconnect?.(); } catch (_) {}
          ENX_JOINS.delete(sid);
        }
        PENDING_DISCONNECTS.delete(sid);
      }, 500);
      PENDING_DISCONNECTS.set(sid, t);
    };
  }, [session?.id]);

  // ----- controls -----
  const toggleAudio = () => {
    const ls = localStreamRef.current;
    if (!ls) return;
    try {
      audioOn ? ls.muteAudio?.() : ls.unmuteAudio?.();
      setAudioOn(!audioOn);
    } catch (_) {}
  };
  const toggleVideo = () => {
    const ls = localStreamRef.current;
    if (!ls) return;
    try {
      videoOn ? ls.muteVideo?.() : ls.unmuteVideo?.();
      setVideoOn(!videoOn);
    } catch (_) {}
  };

  const handleEndCall = async () => {
    setEndingCall(true);
    try {
      try { localStreamRef.current?.disconnect?.(); } catch (_) {}
      try { roomRef.current?.disconnect?.(); } catch (_) {}
      ENX_JOINS.delete(session?.id);
      const pending = PENDING_DISCONNECTS.get(session?.id);
      if (pending) { clearTimeout(pending); PENDING_DISCONNECTS.delete(session?.id); }
      await teleconsultApi.endSession(id);
      navigate('/teleconsult');
    } catch (e) {
      setSnackbar({ severity: 'error', message: e.message });
      setEndingCall(false);
    }
  };

  const copyParticipantLink = async () => {
    try {
      // The participant joins via a small dedicated page (Phase: TODO),
      // for now we share the raw participant token plus a hint.
      const link = session.participant_join_url
        || `${window.location.origin}/teleconsult/join?token=${encodeURIComponent(session.participant_token || '')}`;
      await navigator.clipboard.writeText(link);
      setSnackbar({ severity: 'success', message: 'Patient join info copied' });
    } catch (e) {
      setSnackbar({ severity: 'error', message: 'Copy failed' });
    }
  };

  // ----- render guards -----
  if (loading) {
    return (
      <Box sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !session) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{error || 'Session not found'}</Alert>
        <Button onClick={() => navigate('/teleconsult')} startIcon={<ArrowBack />} sx={{ mt: 2 }}>
          Back to Teleconsult
        </Button>
      </Box>
    );
  }

  if (session.channel !== 'video') {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="info">This is a {session.channel} session, not a video call.</Alert>
      </Box>
    );
  }

  // Google Meet sessions don't use the EnableX SDK — just send the doctor to
  // the Meet URL. Skip PreCallCheck (Meet has its own pre-call lobby).
  if (session.provider_vendor === 'google_meet') {
    const meetUrl = session.moderator_join_url || session.participant_join_url;
    return (
      <Box sx={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', p: 3, bgcolor: 'background.default',
      }}>
        <Box sx={{
          maxWidth: 520, width: '100%', p: 4, borderRadius: 3,
          bgcolor: 'background.paper', boxShadow: 3, textAlign: 'center',
        }}>
          <Videocam sx={{ fontSize: 56, color: 'primary.main', mb: 1 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
            Saranam Teleconsult — Google Meet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            The video call is hosted on Google Meet. Click below to join in a new tab.
            Your camera and microphone permissions will be requested by Meet.
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<OpenInNew />}
            href={meetUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ textTransform: 'none', borderRadius: 5, px: 4, mb: 2 }}
          >
            Join Google Meet
          </Button>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mb: 2 }}>
            <Button
              size="small"
              startIcon={<ContentCopy />}
              onClick={() => {
                navigator.clipboard?.writeText(meetUrl);
                setSnackbar('Meet link copied');
              }}
              sx={{ textTransform: 'none' }}
            >
              Copy link
            </Button>
            <Button
              size="small"
              startIcon={<ArrowBack />}
              onClick={() => navigate('/teleconsult')}
              sx={{ textTransform: 'none' }}
            >
              Back
            </Button>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', wordBreak: 'break-all' }}>
            {meetUrl}
          </Typography>
        </Box>
        <Snackbar
          open={!!snackbar}
          autoHideDuration={2400}
          onClose={() => setSnackbar(null)}
          message={snackbar}
        />
      </Box>
    );
  }

  if (!confirmedReady) {
    return (
      <PreCallCheck
        onReady={() => setConfirmedReady(true)}
        onCancel={() => navigate('/teleconsult')}
      />
    );
  }

  if (!sdkReady) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="warning">
          EnableX SDK still loading. If this persists for more than a few seconds,
          check that <code>/vendor/EnxRtc.js</code> is being served and refresh.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#0a0a0a' }}>
      {/* Header */}
      <Box sx={{
        px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 2,
        borderBottom: 1, borderColor: 'rgba(255,255,255,0.1)',
        bgcolor: 'rgba(0,0,0,0.6)', color: 'white',
      }}>
        <IconButton onClick={() => navigate('/teleconsult')} size="small" sx={{ color: 'white' }}>
          <ArrowBack />
        </IconButton>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>
          Video Consultation
          {connected && (
            <Chip
              label={remoteCount > 0 ? `${remoteCount + 1} connected` : 'Waiting for patient'}
              size="small"
              color={remoteCount > 0 ? 'success' : 'default'}
              sx={{ ml: 2, fontWeight: 600 }}
            />
          )}
        </Typography>
        {session.record_call && (
          <Chip
            icon={<FiberManualRecord sx={{ fontSize: 14, color: 'error.main' }} />}
            label="Recording"
            size="small"
            sx={{ fontWeight: 600, bgcolor: 'rgba(255,255,255,0.1)', color: 'white' }}
          />
        )}
        <Tooltip title="Copy patient join link">
          <Button
            variant="outlined"
            size="small"
            startIcon={<ContentCopy />}
            onClick={copyParticipantLink}
            sx={{ textTransform: 'none', color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}
          >
            Copy patient link
          </Button>
        </Tooltip>
      </Box>

      {/* Video grid */}
      <Box sx={{ flex: 1, p: 2, position: 'relative', overflow: 'hidden' }}>
        {(joining || !connected) && (
          <Box sx={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 5,
          }}>
            <Stack alignItems="center" spacing={2}>
              <CircularProgress sx={{ color: 'white' }} />
              <Typography variant="body2" color="white">
                {joining ? 'Connecting to room…' : 'Initializing…'}
              </Typography>
            </Stack>
          </Box>
        )}

        <Box ref={remoteContainerRef} sx={{
          display: 'flex', flexWrap: 'wrap', gap: 2,
          height: '100%', alignContent: 'center', justifyContent: 'center',
        }}>
          {/* Remote streams attach here as <div id="remote-XXX"/>. SDK renders <video> inside. */}
        </Box>

        {/* Local self-preview (picture-in-picture style) */}
        <Box id="local-video" sx={{
          position: 'absolute', bottom: 80, right: 16,
          width: 220, aspectRatio: '16/9',
          bgcolor: '#000', borderRadius: 2, overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          border: '2px solid rgba(255,255,255,0.2)', zIndex: 4,
        }} />
      </Box>

      {/* Controls bar */}
      <Box sx={{
        px: 2, py: 1.5, display: 'flex', justifyContent: 'center',
        gap: 1.5, bgcolor: 'rgba(0,0,0,0.85)',
        borderTop: 1, borderColor: 'rgba(255,255,255,0.1)',
      }}>
        <IconButton
          onClick={toggleAudio}
          sx={{
            bgcolor: audioOn ? 'rgba(255,255,255,0.15)' : 'error.main',
            color: 'white', '&:hover': { bgcolor: audioOn ? 'rgba(255,255,255,0.25)' : 'error.dark' },
          }}
          disabled={!connected}
        >
          {audioOn ? <Mic /> : <MicOff />}
        </IconButton>
        <IconButton
          onClick={toggleVideo}
          sx={{
            bgcolor: videoOn ? 'rgba(255,255,255,0.15)' : 'error.main',
            color: 'white', '&:hover': { bgcolor: videoOn ? 'rgba(255,255,255,0.25)' : 'error.dark' },
          }}
          disabled={!connected}
        >
          {videoOn ? <Videocam /> : <VideocamOff />}
        </IconButton>
        <Button
          variant="contained"
          color="error"
          startIcon={<CallEnd />}
          onClick={handleEndCall}
          disabled={endingCall}
          sx={{ textTransform: 'none', borderRadius: 5, px: 3 }}
        >
          {endingCall ? 'Ending…' : 'End call'}
        </Button>
      </Box>

      <Snackbar
        open={!!snackbar}
        onClose={() => setSnackbar(null)}
        autoHideDuration={3500}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snackbar && <Alert severity={snackbar.severity}>{snackbar.message}</Alert>}
      </Snackbar>
    </Box>
  );
};

export default VideoCallRoom;
