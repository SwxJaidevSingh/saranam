/**
 * BodyMapView — Interactive body diagram (rewrite §body-map-rewrite, 2026-05-01).
 *
 * One unified body view (line-art front + back PNGs). Two annotation layers
 * sharing the same canvas:
 *
 *   1. User free-click annotations  — RED dot/rect/ellipse + free-form text.
 *      Persisted on doctor_assessments.body_map_annotations (visit-scoped).
 *
 *   2. AI highlights                — PINK ellipse/rect from the BODY_ZONES
 *      library, generated only when the doctor clicks "Generate Patient
 *      Summary." Persisted on patient_ai_summary.body_locations
 *      (patient-scoped). User can edit the description in place — the
 *      underlying zone (geometry) is locked to the library.
 *
 * The pink AI layer renders BELOW the red user layer in z-order so doctor
 * markers stay clickable on top.
 *
 * Free-click annotation shape (unchanged):
 *    { id, kind: 'dot'|'rect'|'ellipse', view: 'front'|'back',
 *      x, y, width?, height?,             // normalized 0..1 in its image
 *      text, labelOffsetX, labelOffsetY }
 *
 * AI highlight shape:
 *    { id, zoneSlug, text, userEdited, createdAt, updatedAt }
 *
 * Backward compatibility for legacy free-click annotations (pre-§4 pixel
 * coords against the old 360 px combined PNG) is preserved via
 * migrateLegacyAnnotation().
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import bodyFrontImage from '../../../assets/body-front.png';
import bodyBackImage from '../../../assets/body-back.png';
import { resolveZone } from '../../../utils/bodyZones';
import BodyZonesCalibrator from '../../../utils/BodyZonesCalibrator';

// ─── Layout constants ────────────────────────────────────────────
const FREECLICK_IMAGE_WIDTH = 240;
const LABEL_OFFSET_X_MAGNITUDE = 70;
const LABEL_OFFSET_Y_DEFAULT = -20;
const LABEL_STACK_STEP = 26;
const DRAG_THRESHOLD_PX = 4;

// Legacy PNG reference (old body-map.png was 360 × ~540 with front+back side-by-side).
const LEGACY_COMBINED_WIDTH = 360;
const LEGACY_COMBINED_HEIGHT = 540;

const TOOLS = [
  { value: 'dot', label: 'Dot', glyph: '●' },
  { value: 'rect', label: 'Rectangle', glyph: '▭' },
  { value: 'ellipse', label: 'Ellipse', glyph: '◯' },
  { value: 'freehand', label: 'Draw', glyph: '✏️' },
];

// ─── Legacy migration ────────────────────────────────────────────
function migrateLegacyAnnotation(a) {
  if (a && a.view && a.kind) return a;
  const rawX = a.x ?? 0;
  const rawY = a.y ?? 0;
  const halfWidth = LEGACY_COMBINED_WIDTH / 2;
  const isBack = rawX >= halfWidth;
  const localX = isBack ? rawX - halfWidth : rawX;
  return {
    id: a.id,
    kind: a.kind || 'dot',
    view: a.view || (isBack ? 'back' : 'front'),
    x: localX / halfWidth,
    y: rawY / LEGACY_COMBINED_HEIGHT,
    width: a.width != null ? a.width / halfWidth : undefined,
    height: a.height != null ? a.height / LEGACY_COMBINED_HEIGHT : undefined,
    text: a.text || '',
    points: a.points,
    labelOffsetX: a.labelOffsetX,
    labelOffsetY: a.labelOffsetY,
    _legacy: true,
  };
}

function computeLabelOffsets(xPx, yPx, sameViewMarkers, containerWidth) {
  const labelOffsetX = xPx > containerWidth / 2 ? LABEL_OFFSET_X_MAGNITUDE : -LABEL_OFFSET_X_MAGNITUDE;
  const side = xPx > containerWidth / 2 ? 'right' : 'left';

  const getSide = (m) => ((m._cx ?? 0) > containerWidth / 2 ? 'right' : 'left');
  const getLabelAbsY = (m) => (m._cy ?? 0) + (m.labelOffsetY ?? LABEL_OFFSET_Y_DEFAULT);

  const sameSide = sameViewMarkers.filter(m => getSide(m) === side);
  const isFree = (candidateAbsY) =>
    !sameSide.some(m => Math.abs(getLabelAbsY(m) - candidateAbsY) < LABEL_STACK_STEP);

  let labelOffsetY = LABEL_OFFSET_Y_DEFAULT;
  if (!isFree(yPx + labelOffsetY)) {
    for (let step = LABEL_STACK_STEP; step < 300; step += LABEL_STACK_STEP) {
      if (isFree(yPx + LABEL_OFFSET_Y_DEFAULT + step)) { labelOffsetY = LABEL_OFFSET_Y_DEFAULT + step; break; }
      if (isFree(yPx + LABEL_OFFSET_Y_DEFAULT - step)) { labelOffsetY = LABEL_OFFSET_Y_DEFAULT - step; break; }
    }
  }
  return { labelOffsetX, labelOffsetY };
}

function estimateImageHeightPx() {
  return FREECLICK_IMAGE_WIDTH * 1.5;
}

// Compute pixel center + label deltas for free-click markers.
function withDisplayFields(markers, containerWidthPx) {
  const H = estimateImageHeightPx();

  return markers.map(m => {
    let cxNorm;
    let cyNorm;

    if (m.kind === 'dot' || m.kind === 'freehand') {
      cxNorm = m.x;
      cyNorm = m.y;
    } else {
      cxNorm = m.x + m.width / 2;
      cyNorm = m.y + m.height / 2;
    }

    const _cx = cxNorm * containerWidthPx;
    const _cy = cyNorm * H;

    return {
      ...m,
      _cx,
      _cy,
      _dx: m.labelOffsetX ?? (_cx > containerWidthPx / 2
        ? LABEL_OFFSET_X_MAGNITUDE
        : -LABEL_OFFSET_X_MAGNITUDE),
      _dy: m.labelOffsetY ?? LABEL_OFFSET_Y_DEFAULT,
    };
  });
}

// Resolve AI highlights ({id, zoneSlug, text, userEdited}) against the zone
// library. Drops items whose slug is unknown (defensive; should not happen
// because the backend validates against the same enum).
function resolveAiHighlights(aiHighlights, containerWidthPx) {
  const H = estimateImageHeightPx();
  const out = { front: [], back: [] };
  (aiHighlights || []).forEach(h => {
    const zone = resolveZone(h.zoneSlug);
    if (!zone) return;
    const cxNorm = zone.x + (zone.width || 0) / 2;
    const cyNorm = zone.y + (zone.height || 0) / 2;
    const _cx = cxNorm * containerWidthPx;
    const _cy = cyNorm * H;
    const _dx = _cx > containerWidthPx / 2 ? LABEL_OFFSET_X_MAGNITUDE : -LABEL_OFFSET_X_MAGNITUDE;
    out[zone.view].push({
      ...h,
      kind: zone.kind,
      view: zone.view,
      x: zone.x, y: zone.y, width: zone.width, height: zone.height,
      _cx, _cy, _dx,
      _dy: LABEL_OFFSET_Y_DEFAULT,
      _zoneLabel: zone.label,
    });
  });
  return out;
}

// ─── Single-image canvas ─────────────────────────────────────────
function BodyImageCanvas({
  view, imageSrc, label, tool,
  markers,
  aiMarkers,
  onCommitShape, onMarkerClick, onAiMarkerClick,
  containerWidth,
  readOnly,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [dragStart, setDragStart] = useState(null);
  const [dragCurrent, setDragCurrent] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const drawingPoints = useRef([]);

  const toNormalized = (clientX, clientY) => {
    const rect = containerRef.current.getBoundingClientRect();
    return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height };
  };

  const toPixel = (clientX, clientY) => {
    const rect = containerRef.current.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  // ── Freehand canvas setup ─────────────────────────────────────
  useEffect(() => {
    if (tool !== 'freehand' || !canvasRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    canvasRef.current.width = rect.width;
    canvasRef.current.height = rect.height;
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, rect.width, rect.height);
  }, [tool]);

  const handleMouseDown = (e) => {
    if (readOnly) return;
    if (e.button !== 0) return;

    if (tool === 'freehand') {
      setIsDrawing(true);
      const pt = toNormalized(e.clientX, e.clientY);
      drawingPoints.current = [pt];

      const rect = containerRef.current.getBoundingClientRect();
      const ctx = canvasRef.current?.getContext('2d');

      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.beginPath();

        ctx.moveTo(
          pt.x * rect.width,
          pt.y * rect.height
        );

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
      return;
    }

    const norm = toNormalized(e.clientX, e.clientY);
    setDragStart(norm);
    setDragCurrent(norm);
  };

  const handleMouseMove = (e) => {
    if (tool === 'freehand') {
      if (!isDrawing) return;

      const pt = toNormalized(e.clientX, e.clientY);

      drawingPoints.current.push(pt);

      const rect = containerRef.current.getBoundingClientRect();
      const ctx = canvasRef.current?.getContext('2d');

      if (ctx) {
        ctx.lineTo(
          pt.x * rect.width,
          pt.y * rect.height
        );
        ctx.stroke();
      }
      return;
    }
    if (!dragStart) return;
    setDragCurrent(toNormalized(e.clientX, e.clientY));
  };

  const handleMouseUp = () => {
    if (tool === 'freehand') {
      if (!isDrawing) return;
      setIsDrawing(false);
      const points = drawingPoints.current;
      drawingPoints.current = [];
      if (points.length < 3) {
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        return;
      }
      const cx =
        points.reduce((s, p) => s + p.x, 0) / points.length;

      const cy =
        points.reduce((s, p) => s + p.y, 0) / points.length;

      onCommitShape({
        view,
        kind: 'freehand',
        points,
        x: cx,
        y: cy
      });
      // Clear the live canvas after committing
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      return;
    }

    if (!dragStart || !dragCurrent) {
      setDragStart(null); setDragCurrent(null);
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    const dxPx = Math.abs((dragCurrent.x - dragStart.x) * rect.width);
    const dyPx = Math.abs((dragCurrent.y - dragStart.y) * rect.height);
    const isDrag = dxPx > DRAG_THRESHOLD_PX || dyPx > DRAG_THRESHOLD_PX;

    if (tool === 'dot' || !isDrag) {
      onCommitShape({ view, kind: 'dot', x: dragCurrent.x, y: dragCurrent.y });
    } else {
      const minX = Math.min(dragStart.x, dragCurrent.x);
      const minY = Math.min(dragStart.y, dragCurrent.y);
      const width = Math.abs(dragCurrent.x - dragStart.x);
      const height = Math.abs(dragCurrent.y - dragStart.y);
      onCommitShape({ view, kind: tool, x: minX, y: minY, width, height });
    }
    setDragStart(null); setDragCurrent(null);
  };

  const handleMouseLeave = () => {
    if (tool === 'freehand' && isDrawing) {
      // commit whatever was drawn so far
      handleMouseUp();
      return;
    }
    setDragStart(null); setDragCurrent(null);
  };

  const previewShape = useMemo(() => {
    if (!dragStart || !dragCurrent || tool === 'dot' || tool === 'freehand') return null;
    return {
      x: Math.min(dragStart.x, dragCurrent.x),
      y: Math.min(dragStart.y, dragCurrent.y),
      width: Math.abs(dragCurrent.x - dragStart.x),
      height: Math.abs(dragCurrent.y - dragStart.y),
      kind: tool,
    };
  }, [dragStart, dragCurrent, tool]);

  const isBack = view === 'back';
  const leftChipLabel = isBack ? 'L' : 'R';
  const rightChipLabel = isBack ? 'R' : 'L';

  return (
    <div className="text-center">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        className={`relative select-none ${readOnly ? '' : 'cursor-crosshair'}`}
        style={{ width: `${containerWidth}px` }}
      >
        <img src={imageSrc} alt={`${label} body map`} draggable={false}
          className="block w-full h-auto pointer-events-none bg-white" />

        <div className="absolute top-1 left-1 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 bg-blue-100/80 border border-blue-300 rounded pointer-events-none leading-none">{leftChipLabel}</div>
        <div className="absolute top-1 right-1 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 bg-blue-100/80 border border-blue-300 rounded pointer-events-none leading-none">{rightChipLabel}</div>

        {/* Live freehand canvas */}
        {!readOnly && tool === 'freehand' && (
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full"
            style={{ pointerEvents: 'none' }}
          />
        )}

        {/* AI layer */}
        <svg className="absolute top-0 left-0 w-full h-full" style={{ pointerEvents: 'none', overflow: 'visible' }} aria-hidden="true">
          {aiMarkers.map(m => (
            m.kind === 'ellipse' ? (
              <ellipse key={`ai-${m.id}`}
                cx={`${(m.x + m.width / 2) * 100}%`} cy={`${(m.y + m.height / 2) * 100}%`}
                rx={`${(m.width / 2) * 100}%`} ry={`${(m.height / 2) * 100}%`}
                fill="rgba(37,99,235,0.15)" stroke="#2563eb" strokeWidth="1.4"
              />
            ) : (
              <rect key={`ai-${m.id}`}
                x={`${m.x * 100}%`} y={`${m.y * 100}%`}
                width={`${m.width * 100}%`} height={`${m.height * 100}%`}
                fill="rgba(37,99,235,0.15)" stroke="#2563eb" strokeWidth="1.4"
              />
            )
          ))}
          {aiMarkers.map(m => (
            <line key={`ai-line-${m.id}`}
              x1={m._cx} y1={m._cy}
              x2={m._cx + m._dx} y2={m._cy + m._dy}
              stroke="#1d4ed8" strokeWidth="1"
            />
          ))}
        </svg>

        {/* User shapes (dot/rect/ellipse) layer */}
        <svg className="absolute top-0 left-0 w-full h-full" style={{ pointerEvents: 'none', overflow: 'visible' }} aria-hidden="true">
          {markers.filter(m => m.kind !== 'freehand').map((m) => {
            if (m.kind === 'rect') return (
              <rect key={`shape-${m.id}`}
                x={`${m.x * 100}%`} y={`${m.y * 100}%`}
                width={`${(m.width || 0) * 100}%`} height={`${(m.height || 0) * 100}%`}
                fill="rgba(239, 68, 68, 0.18)" stroke="#ef4444" strokeWidth="1.5" />
            );
            if (m.kind === 'ellipse') {
              const cx = m.x + (m.width || 0) / 2;
              const cy = m.y + (m.height || 0) / 2;
              return (
                <ellipse key={`shape-${m.id}`}
                  cx={`${cx * 100}%`} cy={`${cy * 100}%`}
                  rx={`${((m.width || 0) / 2) * 100}%`} ry={`${((m.height || 0) / 2) * 100}%`}
                  fill="rgba(239, 68, 68, 0.18)" stroke="#ef4444" strokeWidth="1.5" />
              );
            }
            return null;
          })}
          {/* Freehand strokes */}
          {markers
            .filter(m => m.kind === 'freehand' && m.points?.length > 1)
            .map((m) => {
              const rect = containerRef.current?.getBoundingClientRect();

              const width = rect?.width || containerWidth;
              const height = rect?.height || estimateImageHeightPx();

              const d = m.points
                .map((p, i) => {
                  const x = p.x * width;
                  const y = p.y * height;

                  return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                })
                .join(' ');

              return (
                <path
                  key={`freehand-${m.id}`}
                  d={d}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}
          {/* Connector lines for all user markers */}
          {markers
            .filter(m => m.text)
            .map((m) => (
              <line
                key={`line-${m.id}`}
                x1={m._cx}
                y1={m._cy}
                x2={m._cx + m._dx}
                y2={m._cy + m._dy}
                stroke="#111827"
                strokeWidth="1"
              />
            ))}
          {previewShape && previewShape.kind === 'rect' && (
            <rect x={`${previewShape.x * 100}%`} y={`${previewShape.y * 100}%`}
              width={`${previewShape.width * 100}%`} height={`${previewShape.height * 100}%`}
              fill="rgba(59, 130, 246, 0.18)" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="4 3" />
          )}
          {previewShape && previewShape.kind === 'ellipse' && (
            <ellipse cx={`${(previewShape.x + previewShape.width / 2) * 100}%`}
              cy={`${(previewShape.y + previewShape.height / 2) * 100}%`}
              rx={`${(previewShape.width / 2) * 100}%`}
              ry={`${(previewShape.height / 2) * 100}%`}
              fill="rgba(59, 130, 246, 0.18)" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="4 3" />
          )}
        </svg>

        {/* AI labels */}
        {aiMarkers.map(m => (
          <div key={`ai-label-${m.id}`}
            title={`AI suggestion: ${m._zoneLabel}\n${m.text}`}
            onClick={(e) => { e.stopPropagation(); onAiMarkerClick(m); }}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute bg-blue-50 border border-blue-300 rounded px-1.5 py-0.5 text-[10px] font-medium text-blue-900 shadow-sm cursor-pointer hover:bg-blue-100 whitespace-nowrap max-w-[160px] overflow-hidden text-ellipsis pointer-events-auto"
            style={{
              top: `${m._cy + m._dy}px`, left: `${m._cx + m._dx}px`,
              transform: m._dx < 0 ? 'translate(-100%, -50%)' : 'translate(0, -50%)',
            }}
          >{m.text}</div>
        ))}

        {/* User labels (non-freehand) */}
        {markers.filter(m => m.kind !== 'freehand').map((m) => (
          <div key={`label-${m.id}`}
            title={m.text}
            onClick={(e) => { e.stopPropagation(); onMarkerClick(m); }}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute bg-white border border-gray-400 rounded px-1.5 py-0.5 text-[10px] font-medium text-gray-800 shadow-sm cursor-pointer hover:bg-gray-50 whitespace-nowrap max-w-[140px] overflow-hidden text-ellipsis pointer-events-auto"
            style={{
              top: `${m._cy + m._dy}px`, left: `${m._cx + m._dx}px`,
              transform: m._dx < 0 ? 'translate(-100%, -50%)' : 'translate(0, -50%)',
            }}
          >{m.text}</div>
        ))}

        {/* Freehand labels */}
        {markers.filter(m => m.kind === 'freehand' && m.text).map((m) => (
          <div key={`freehand-label-${m.id}`}
            onClick={(e) => { e.stopPropagation(); onMarkerClick(m); }}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute bg-white border border-red-300 rounded px-1.5 py-0.5 text-[10px] font-medium text-gray-800 shadow-sm cursor-pointer hover:bg-gray-50 whitespace-nowrap max-w-[140px] overflow-hidden text-ellipsis pointer-events-auto"
            style={{
              top: `${m._cy + m._dy}px`, left: `${m._cx + m._dx}px`,
              transform: m._dx < 0 ? 'translate(-100%, -50%)' : 'translate(0, -50%)',
            }}
          >{m.text}</div>
        ))}

        {/* Dots */}
        {markers.filter(m => m.kind === 'dot').map((m) => (
          <button key={`dot-${m.id}`} type="button" title={m.text}
            onClick={(e) => { e.stopPropagation(); onMarkerClick(m); }}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute w-[9px] h-[9px] bg-red-500 rounded-full ring-2 ring-white shadow hover:scale-125 transition-transform pointer-events-auto"
            style={{ top: `${m._cy}px`, left: `${m._cx}px`, transform: 'translate(-50%, -50%)' }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────
const BodyMapView = ({
  readOnly = true,
  freeClickMarkers = [],
  onMarkersChange,
  aiHighlights = [],
  onAiHighlightsChange,
}) => {
  // dev-only calibration tool
  const calibrate = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('calibrate') === 'zones';
  if (calibrate && import.meta.env.DEV) {
    return <BodyZonesCalibrator />;
  }

  const [tool, setTool] = useState('dot');
  const [pendingShape, setPendingShape] = useState(null);   // creating a new free-click marker
  const [editing, setEditing] = useState(null);             // editing existing — { source: 'user'|'ai', marker }
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAi, setShowAi] = useState(true);

  // User free-click markers, by view
  const freeClickMarkersByView = useMemo(() => {
    const migrated = (freeClickMarkers || []).map(migrateLegacyAnnotation);
    return {
      front: withDisplayFields(migrated.filter(m => m.view === 'front'), FREECLICK_IMAGE_WIDTH),
      back: withDisplayFields(migrated.filter(m => m.view === 'back'), FREECLICK_IMAGE_WIDTH),
    };
  }, [freeClickMarkers]);

  // AI highlights, by view (resolved against zone library)
  const aiByView = useMemo(
    () => resolveAiHighlights(aiHighlights, FREECLICK_IMAGE_WIDTH),
    [aiHighlights]
  );

  const closeAdd = () => { setPendingShape(null); };
  const closeEdit = () => { setEditing(null); setEditText(''); };

  // Create new free-click marker
  const handleCommitShape = (shape) => {
    setPendingShape(shape);
    setEditing(null);
  };

  const handleSaveNewMarker = async () => {
    const text = editText.trim();
    if (!text || !pendingShape) return;
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const { kind, view, x, y, width, height } = pendingShape;
    const cxNorm =
      kind === 'dot' || kind === 'freehand'
        ? x
        : x + width / 2;

    const cyNorm =
      kind === 'dot' || kind === 'freehand'
        ? y
        : y + height / 2;
    const cxPx = cxNorm * FREECLICK_IMAGE_WIDTH;
    const cyPx = cyNorm * estimateImageHeightPx();
    const sameView = freeClickMarkersByView[view] || [];
    const { labelOffsetX, labelOffsetY } = computeLabelOffsets(cxPx, cyPx, sameView, FREECLICK_IMAGE_WIDTH);

    const newAnnotation = {
      id, kind, view, x, y,
      ...(kind === 'freehand' ? { points: pendingShape.points } : {}),
      ...(kind !== 'dot' && kind !== 'freehand' ? { width, height } : {}),
      text: text || '',
      labelOffsetX,
      labelOffsetY,
    };
    const cleanedExisting = (freeClickMarkers || []).map(migrateLegacyAnnotation).map(a => {
      const { _legacy, _cx, _cy, _dx, _dy, ...rest } = a;
      return rest;
    });
    const next = [...cleanedExisting, newAnnotation];

    if (onMarkersChange) {
      try {
        setSaving(true);
        await onMarkersChange(next);
      } catch (err) {
        alert('Failed to save note. Please try again.');
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    setPendingShape(null);
    setEditText('');
  };

  // Edit existing user marker
  const openEditUserMarker = (marker) => {
    setEditing({ source: 'user', marker });
    setEditText(marker.text || '');
    setPendingShape(null);
  };

  // Edit existing AI marker
  const openEditAiMarker = (marker) => {
    setEditing({ source: 'ai', marker });
    setEditText(marker.text || '');
    setPendingShape(null);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    const text = editText.trim();
    if (!text) return;

    if (editing.source === 'user') {
      const cleaned = (freeClickMarkers || []).map(migrateLegacyAnnotation).map(a => {
        const { _legacy, _cx, _cy, _dx, _dy, ...rest } = a;
        return rest;
      });
      const next = cleaned.map(m => m.id === editing.marker.id ? { ...m, text } : m);
      if (onMarkersChange) {
        try {
          setSaving(true);
          await onMarkersChange(next);
        } catch (err) {
          alert('Failed to update note. Please try again.');
          setSaving(false);
          return;
        }
        setSaving(false);
      }
    } else {
      // ai marker — set userEdited=true
      const next = (aiHighlights || []).map(h =>
        h.id === editing.marker.id
          ? { ...h, text, userEdited: true, updatedAt: new Date().toISOString() }
          : h
      );
      if (onAiHighlightsChange) {
        try {
          setSaving(true);
          await onAiHighlightsChange(next);
        } catch (err) {
          alert('Failed to update AI highlight. Please try again.');
          setSaving(false);
          return;
        }
        setSaving(false);
      }
    }
    closeEdit();
  };

  const handleDeleteEdit = async () => {
    if (!editing) return;
    if (editing.source === 'user') {
      const cleaned = (freeClickMarkers || []).map(migrateLegacyAnnotation).map(a => {
        const { _legacy, _cx, _cy, _dx, _dy, ...rest } = a;
        return rest;
      });
      const next = cleaned.filter(m => m.id !== editing.marker.id);
      if (onMarkersChange) {
        try {
          setSaving(true);
          await onMarkersChange(next);
        } catch (err) {
          alert('Failed to delete note. Please try again.');
          setSaving(false);
          return;
        }
        setSaving(false);
      }
    } else {
      const next = (aiHighlights || []).filter(h => h.id !== editing.marker.id);
      if (onAiHighlightsChange) {
        try {
          setSaving(true);
          await onAiHighlightsChange(next);
        } catch (err) {
          alert('Failed to delete AI highlight. Please try again.');
          setSaving(false);
          return;
        }
        setSaving(false);
      }
    }
    closeEdit();
  };

  // ESC closes
  useEffect(() => {
    if (!pendingShape && !editing) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { closeAdd(); closeEdit(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pendingShape, editing]);

  const aiCount = (aiHighlights || []).length;
  const userCount = (freeClickMarkers || []).length;

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span className="text-[11px] text-muted-foreground font-medium">Tool:</span>
            <div className="inline-flex rounded border border-blue-200 overflow-hidden text-[11px] font-medium">
              {TOOLS.map((t, i) => (
                <button
                  key={t.value}
                  onClick={() => setTool(t.value)}
                  className={`px-2.5 py-1 transition-colors ${i > 0 ? 'border-l border-blue-200' : ''} ${tool === t.value ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 hover:bg-blue-50'}`}
                >
                  <span className="mr-1">{t.glyph}</span>{t.label}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground italic">
              {tool === 'dot' ? 'Click to drop a dot' : 'Drag to draw a shape'}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground italic text-center">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1 align-middle" />Your notes &nbsp;
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1 align-middle" />AI suggestions — generated when you click Generate Patient Summary.
            Click any marker to edit or delete.
          </p>

          <div className="flex items-center gap-2 flex-wrap justify-center">
            <button
              type="button"
              onClick={() => setShowAi(s => !s)}
              disabled={aiCount === 0}
              className="text-[11px] font-medium px-2.5 py-1 rounded border border-blue-200 bg-white text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title={showAi ? 'Hide AI-suggested highlights' : 'Show AI-suggested highlights'}
            >
              {showAi ? '🙈 Hide AI highlights' : '👁 Show AI highlights'}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (aiCount === 0 || !onAiHighlightsChange) return;
                if (!window.confirm(`Clear all ${aiCount} AI suggestion${aiCount === 1 ? '' : 's'}? This cannot be undone.`)) return;
                try { setSaving(true); await onAiHighlightsChange([]); }
                catch (_) { alert('Failed to clear AI highlights. Please try again.'); }
                finally { setSaving(false); }
              }}
              disabled={aiCount === 0 || saving}
              className="text-[11px] font-medium px-2.5 py-1 rounded border border-amber-300 bg-white text-amber-700 hover:bg-amber-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Clear AI suggestions
            </button>
            <button
              type="button"
              onClick={async () => {
                const total = userCount + aiCount;
                if (total === 0) return;
                if (!window.confirm(`Clear the entire body map (${userCount} note${userCount === 1 ? '' : 's'} + ${aiCount} AI suggestion${aiCount === 1 ? '' : 's'})? This cannot be undone.`)) return;
                try {
                  setSaving(true);
                  if (onMarkersChange && userCount > 0) await onMarkersChange([]);
                  if (onAiHighlightsChange && aiCount > 0) await onAiHighlightsChange([]);
                } catch (_) {
                  alert('Failed to clear body map. Please try again.');
                } finally { setSaving(false); }
              }}
              disabled={(userCount + aiCount) === 0 || saving}
              className="text-[11px] font-medium px-2.5 py-1 rounded border border-red-300 bg-white text-red-700 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Clear entire body map
            </button>
          </div>
        </div>
      )}

      {/* {aiCount > 0 && (
        <div className="mx-auto max-w-2xl flex items-start gap-2 px-3 py-2 rounded border border-amber-300 bg-amber-50 text-amber-900 text-[11px]">
          <span aria-hidden="true">⚠️</span>
          <span>
            <strong>AI-suggested highlights — review before sharing.</strong> The blue markers are generated by AI from the assessments and may be inaccurate or miss findings. Click a marker to edit or remove it.
          </span>
        </div>
      )} */}

      <div className="flex items-start justify-center gap-16 flex-wrap">
        <BodyImageCanvas
          view="front" imageSrc={bodyFrontImage} label="Front" tool={tool}
          markers={freeClickMarkersByView.front}
          aiMarkers={showAi ? aiByView.front : []}
          onCommitShape={handleCommitShape}
          onMarkerClick={openEditUserMarker}
          onAiMarkerClick={openEditAiMarker}
          containerWidth={FREECLICK_IMAGE_WIDTH}
          readOnly={readOnly}
        />
        <BodyImageCanvas
          view="back" imageSrc={bodyBackImage} label="Back" tool={tool}
          markers={freeClickMarkersByView.back}
          aiMarkers={showAi ? aiByView.back : []}
          onCommitShape={handleCommitShape}
          onMarkerClick={openEditUserMarker}
          onAiMarkerClick={openEditAiMarker}
          containerWidth={FREECLICK_IMAGE_WIDTH}
          readOnly={readOnly}
        />
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        {userCount === 0 && aiCount === 0
          ? 'No annotations yet.'
          : (
            <>
              {userCount > 0 && <span>{userCount} note{userCount === 1 ? '' : 's'}</span>}
              {userCount > 0 && aiCount > 0 && <span> • </span>}
              {aiCount > 0 && <span>{aiCount} AI suggestion{aiCount === 1 ? '' : 's'}</span>}
            </>
          )
        }
      </p>

      {/* Add-marker modal (creating a brand new free-click marker) */}
      {pendingShape && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => { setPendingShape(null); setEditText(''); }}
        >
          <div className="bg-background rounded-lg shadow-xl p-4 w-80 border border-border" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold mb-1 text-foreground">
              Add a {pendingShape.kind === 'dot' ? 'dot marker' : pendingShape.kind === 'rect' ? 'rectangular area' : 'ellipse area'}
            </p>
            <p className="text-[10px] text-muted-foreground mb-2">on the <strong>{pendingShape.view}</strong> view</p>
            <textarea
              autoFocus
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              placeholder="Describe the finding…"
              className="w-full border border-border rounded px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background text-foreground"
              rows={3}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveNewMarker(); }}
            />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => { setPendingShape(null); setEditText(''); }} disabled={saving}
                className="text-xs px-3 py-1.5 rounded border border-border text-foreground hover:bg-muted">Cancel</button>
              <button onClick={handleSaveNewMarker} disabled={saving || !editText.trim()}
                className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal — user or AI */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={closeEdit}
        >
          <div className="bg-background rounded-lg shadow-xl p-4 w-80 border border-border" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold mb-1 text-foreground">
              Edit {editing.source === 'ai' ? (
                <span className="text-blue-700">AI suggestion</span>
              ) : (
                editing.marker.kind === 'dot' ? 'dot marker' : editing.marker.kind === 'rect' ? 'rectangular area' : 'ellipse area'
              )}
              <span className="text-[10px] font-normal text-muted-foreground ml-1.5">
                ({editing.source === 'ai' ? `${resolveZone(editing.marker.zoneSlug)?.label || editing.marker.zoneSlug}` : editing.marker.view})
              </span>
            </p>
            {editing.source === 'ai' && editing.marker.userEdited && (
              <p className="text-[10px] text-amber-700 mb-2">Edited — protected from auto-overwrite on regenerate.</p>
            )}
            <textarea
              autoFocus
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              placeholder="Describe the finding…"
              className="w-full border border-border rounded px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background text-foreground"
              rows={3}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveEdit(); }}
            />
            <div className="flex justify-between gap-2 mt-3">
              <button onClick={handleDeleteEdit} disabled={saving}
                className="text-xs px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                {saving ? 'Working…' : 'Delete'}
              </button>
              <div className="flex gap-2">
                <button onClick={closeEdit} disabled={saving}
                  className="text-xs px-3 py-1.5 rounded border border-border text-foreground hover:bg-muted">Cancel</button>
                <button onClick={handleSaveEdit} disabled={saving || !editText.trim() || editText.trim() === (editing.marker.text || '')}
                  className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BodyMapView;