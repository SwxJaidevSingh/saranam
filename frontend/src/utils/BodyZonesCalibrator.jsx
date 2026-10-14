/**
 * BodyZonesCalibrator — dev-only tool to calibrate the BODY_ZONES library.
 *
 * Activate by appending `?calibrate=zones` to ANY patient route while running
 * the dev server. The tool overlays existing zones on the line-art bodies
 * and lets you click/drag to capture new normalized coordinates, then copy
 * them as a code-ready snippet.
 *
 * Excluded from production builds via `import.meta.env.DEV` guard in
 * BodyMapView.jsx.
 */
import React, { useRef, useState } from 'react';
import bodyFrontImage from '../assets/body-front.png';
import bodyBackImage from '../assets/body-back.png';
import { BODY_ZONES } from './bodyZones';

const IMG_WIDTH = 360;

function ImagePane({ view, src, zones, onCommit }) {
  const ref = useRef(null);
  const [drag, setDrag] = useState(null); // {x0, y0, x1, y1}

  const norm = (e) => {
    const r = ref.current.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / r.width,
      y: (e.clientY - r.top) / r.height,
    };
  };

  const down = (e) => {
    const p = norm(e);
    setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };
  const move = (e) => {
    if (!drag) return;
    const p = norm(e);
    setDrag(d => ({ ...d, x1: p.x, y1: p.y }));
  };
  const up = () => {
    if (!drag) return;
    const x = Math.min(drag.x0, drag.x1);
    const y = Math.min(drag.y0, drag.y1);
    const w = Math.abs(drag.x1 - drag.x0);
    const h = Math.abs(drag.y1 - drag.y0);
    if (w < 0.01 && h < 0.01) {
      // treat as point
      onCommit({ view, x: drag.x0, y: drag.y0, width: 0, height: 0 });
    } else {
      onCommit({ view, x, y, width: w, height: h });
    }
    setDrag(null);
  };

  const dragRect = drag ? {
    x: Math.min(drag.x0, drag.x1),
    y: Math.min(drag.y0, drag.y1),
    w: Math.abs(drag.x1 - drag.x0),
    h: Math.abs(drag.y1 - drag.y0),
  } : null;

  return (
    <div style={{ display: 'inline-block', textAlign: 'center', margin: '0 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{view.toUpperCase()}</div>
      <div
        ref={ref}
        onMouseDown={down}
        onMouseMove={move}
        onMouseUp={up}
        onMouseLeave={() => setDrag(null)}
        style={{ position: 'relative', width: IMG_WIDTH, cursor: 'crosshair', userSelect: 'none' }}
      >
        <img src={src} alt={view} draggable={false} style={{ display: 'block', width: '100%', pointerEvents: 'none' }} />
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        >
          {zones.filter(z => z.view === view).map(z => (
            z.kind === 'ellipse' ? (
              <ellipse key={z.slug}
                cx={`${(z.x + z.width / 2) * 100}%`} cy={`${(z.y + z.height / 2) * 100}%`}
                rx={`${(z.width / 2) * 100}%`}     ry={`${(z.height / 2) * 100}%`}
                fill="rgba(37,99,235,0.15)" stroke="#2563eb" strokeWidth="1.2" strokeDasharray="3 2"
              />
            ) : (
              <rect key={z.slug}
                x={`${z.x * 100}%`} y={`${z.y * 100}%`}
                width={`${z.width * 100}%`} height={`${z.height * 100}%`}
                fill="rgba(37,99,235,0.15)" stroke="#2563eb" strokeWidth="1.2" strokeDasharray="3 2"
              />
            )
          ))}
          {zones.filter(z => z.view === view).map(z => (
            <text key={`l-${z.slug}`}
              x={`${(z.x + z.width / 2) * 100}%`}
              y={`${(z.y + z.height / 2) * 100}%`}
              fontSize="9" fill="#1e3a8a" textAnchor="middle"
              dominantBaseline="middle"
            >{z.slug}</text>
          ))}
          {dragRect && (
            <rect x={`${dragRect.x * 100}%`} y={`${dragRect.y * 100}%`}
              width={`${dragRect.w * 100}%`} height={`${dragRect.h * 100}%`}
              fill="rgba(59,130,246,0.18)" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="4 3"
            />
          )}
        </svg>
      </div>
    </div>
  );
}

export default function BodyZonesCalibrator() {
  const [last, setLast] = useState(null);
  const [slug, setSlug] = useState('new_zone');
  const [kind, setKind] = useState('rect');

  const snippet = last ? `{ slug: '${slug}', view: '${last.view}', kind: '${kind}', x: ${last.x.toFixed(3)}, y: ${last.y.toFixed(3)}, width: ${last.width.toFixed(3)}, height: ${last.height.toFixed(3)}, label: '${slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}' },` : '';

  const copy = () => {
    if (!snippet) return;
    navigator.clipboard.writeText(snippet);
  };

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Body Zones Calibrator <span style={{ fontSize: 11, color: '#888' }}>(dev only)</span></h2>
      <p style={{ fontSize: 12, color: '#555', marginBottom: 16 }}>
        Drag a box on either body to capture normalized coordinates. Use the snippet below to add or update an entry in <code>bodyZones.js</code>.
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, fontSize: 13 }}>
        <label>Slug: <input value={slug} onChange={e => setSlug(e.target.value)} style={{ padding: 4, marginLeft: 4, width: 160 }} /></label>
        <label>Kind:
          <select value={kind} onChange={e => setKind(e.target.value)} style={{ marginLeft: 4 }}>
            <option value="rect">rect</option>
            <option value="ellipse">ellipse</option>
          </select>
        </label>
        <button onClick={copy} disabled={!snippet} style={{ padding: '4px 10px' }}>Copy snippet</button>
      </div>
      <div>
        <ImagePane view="front" src={bodyFrontImage} zones={BODY_ZONES} onCommit={setLast} />
        <ImagePane view="back"  src={bodyBackImage}  zones={BODY_ZONES} onCommit={setLast} />
      </div>
      {last && (
        <div style={{ marginTop: 16, padding: 12, background: '#f3f4f6', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap' }}>
          {snippet}
        </div>
      )}
    </div>
  );
}
