import { useMemo } from 'react';
import { encode } from 'uqr';

/** QR code drawn as plain SVG rectangles (no HTML injection). */
export function QrCode({ text, label }: { text: string; label: string }) {
  const matrix = useMemo(() => encode(text, { ecc: 'M', border: 2 }).data, [text]);
  const size = matrix.length;
  return (
    <svg
      className="qr-code"
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="#fff" />
      {matrix.flatMap((row, y) =>
        row.map((dark, x) =>
          dark ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#000" /> : null,
        ),
      )}
    </svg>
  );
}
