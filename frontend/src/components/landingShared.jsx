
/* Simplified Union Jack — no external asset needed for the English option */
export function UKFlag({ size = 18 }) {
  return (
    <svg width={size} height={size * 0.65} viewBox="0 0 60 36" style={{ borderRadius: 3, flexShrink: 0, display: 'block' }}>
      <rect width="60" height="36" fill="#00247d" />
      <path d="M0,0 L60,36 M60,0 L0,36" stroke="#fff" strokeWidth="7" />
      <path d="M0,0 L60,36 M60,0 L0,36" stroke="#cf142b" strokeWidth="2.6" />
      <path d="M30,0 L30,36 M0,18 L60,18" stroke="#fff" strokeWidth="11" />
      <path d="M30,0 L30,36 M0,18 L60,18" stroke="#cf142b" strokeWidth="6.5" />
    </svg>
  );
}
