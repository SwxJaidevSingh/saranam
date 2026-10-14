/**
 * FollowupSummaryHistorySection — patient Overview tab.
 *
 * Per 2026-05-13 client meeting. Two sub-cards driven by one fetch:
 *
 *   1. Latest Patient Health — the most recent visit_ai_summaries row.
 *      Always visible. Falls back gracefully when no follow-ups exist yet.
 *
 *   2. Past Records — chronological log (newest first) of all follow-up
 *      summaries for this patient. Collapsed by default; expanded reveals
 *      the full history so a clinician picking up the patient mid-journey
 *      can see how things have progressed.
 *
 * MUI styling matches the surrounding OverviewTab.
 */
import React, { useEffect, useState } from 'react';
import {
  Paper, Box, Typography, Button, CircularProgress, Collapse, Chip, Divider,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import HistoryIcon from '@mui/icons-material/History';
import HealingIcon from '@mui/icons-material/Healing';
import saranamApi from '../../api/saranam';


function formatVisitDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });
}

function formatGeneratedAt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}


export default function FollowupSummaryHistorySection({ patient }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!patient?.id) return undefined;
    setLoading(true);
    saranamApi.listFollowupSummaries(patient.id)
      .then((res) => {
        if (cancelled) return;
        setItems(Array.isArray(res?.items) ? res.items : []);
      })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [patient?.id]);

  const latest = items[0] || null;
  const olderItems = items.slice(1);

  return (
    <>
      {/* ── Latest Patient Health card ───────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'success.main', display: 'flex', alignItems: 'center', gap: 1 }}>
              <HealingIcon fontSize="small" /> Latest Patient Health
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Most recent follow-up visit summary. Updated automatically when a follow-up summary is generated and saved.
            </Typography>
          </Box>
          {latest && (
            <Chip
              size="small"
              label={`Visit #${latest.visit_number} • ${formatVisitDate(latest.visit_date)}`}
              variant="outlined"
              color="success"
            />
          )}
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={20} />
          </Box>
        ) : !latest ? (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', py: 1 }}>
            No follow-up summaries yet. Generate one from a follow-up visit to populate this card.
          </Typography>
        ) : (
          <>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>
              {latest.summary_text}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
              Generated {formatGeneratedAt(latest.generated_at)}
              {latest.model_used ? ` • ${latest.model_used}` : ''}
            </Typography>
          </>
        )}
      </Paper>

      {/* ── Past Records section (collapsed by default) ──────────────── */}
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Box
          onClick={() => setExpanded(!expanded)}
          sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer', userSelect: 'none',
          }}
        >
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
              <HistoryIcon fontSize="small" /> Past Records
              <Chip
                size="small"
                label={`${items.length} ${items.length === 1 ? 'summary' : 'summaries'}`}
                variant="outlined"
                sx={{ ml: 0.5 }}
              />
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Chronological log of every follow-up summary for this patient (newest first).
            </Typography>
          </Box>
          <Button
            size="small"
            variant="text"
            endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            {expanded ? 'Hide' : 'Show all'}
          </Button>
        </Box>

        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Box sx={{ mt: 2 }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={20} />
              </Box>
            ) : items.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', py: 1 }}>
                No past follow-up summaries yet.
              </Typography>
            ) : (
              items.map((item, idx) => (
                <Box key={item.id} sx={{ mb: idx === items.length - 1 ? 0 : 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Chip
                      size="small"
                      label={`Visit #${item.visit_number}`}
                      variant="outlined"
                      color={idx === 0 ? 'success' : 'default'}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {formatVisitDate(item.visit_date)}
                      {' • '}generated {formatGeneratedAt(item.generated_at)}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', pl: 0.5 }}>
                    {item.summary_text}
                  </Typography>
                  {idx < items.length - 1 && <Divider sx={{ mt: 2 }} />}
                </Box>
              ))
            )}
          </Box>
        </Collapse>
      </Paper>
    </>
  );
}
