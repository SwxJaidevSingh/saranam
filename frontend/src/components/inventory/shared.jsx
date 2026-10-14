/** Shared pieces for the inventory pages: bold-markdown messages and plain data tables. */
import React from 'react';
import {
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';

/** Render text with Streamlit-style **bold** segments. */
export function Md({ children }) {
  const parts = String(children ?? '').split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') && p.length > 4
        ? <strong key={i}>{p.slice(2, -2)}</strong>
        : <React.Fragment key={i}>{p}</React.Fragment>))}
    </>
  );
}

const fmt = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return v.replace('T', ' ').slice(0, 19);
  return String(v);
};

/**
 * A read-only table like st.dataframe: columns default to the keys of the first row.
 * `columns` may be [key] or [[key, label]] pairs.
 */
export function DataTable({ rows, columns, minWidth, maxHeight = 520 }) {
  if (!rows?.length) return null;
  const cols = (columns || Object.keys(rows[0])).map(c => (Array.isArray(c) ? c : [c, c]));
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight, overflowX: 'auto' }}>
      <Table size="small" stickyHeader sx={{ minWidth }}>
        <TableHead>
          <TableRow>
            {cols.map(([key, label]) => (
              <TableCell key={key} sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={r.id ?? r.stock_id ?? i} hover>
              {cols.map(([key]) => (
                <TableCell key={key} sx={{ whiteSpace: 'nowrap' }}>{fmt(r[key])}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export function PageHeader({ title, caption }) {
  return (
    <div>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>{title}</Typography>
      {caption && <Typography variant="body2" color="text.secondary">{caption}</Typography>}
    </div>
  );
}

export function Metric({ label, value, caption }) {
  return (
    <div>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>{value}</Typography>
      {caption && <Typography variant="caption" color="text.secondary">{caption}</Typography>}
    </div>
  );
}
