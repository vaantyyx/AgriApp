function escapeCsvCell(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

/** rows: array of objects; columns: [{ key, header }] in output order. */
export function downloadCsv(filename, columns, rows) {
  const lines = [
    columns.map(c => escapeCsvCell(c.header)).join(','),
    ...rows.map(row => columns.map(c => escapeCsvCell(row[c.key])).join(',')),
  ];
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
