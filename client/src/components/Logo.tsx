import { useId } from 'react';
import { BRAND } from '../theme';

const TEETH = [0, 45, 90, 135, 180, 225, 270, 315];

export function Logo({ size = 34 }: { size?: number }) {
  const gradientId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="Apex ERP logo" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={BRAND.primaryLight} />
          <stop offset="100%" stopColor={BRAND.primaryDark} />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${gradientId})`} />
      <g transform="translate(16 16)" fill="#fff">
        {TEETH.map((angle) => (
          <rect key={angle} x="-2.3" y="-11.5" width="4.6" height="5.5" rx="1.2" transform={`rotate(${angle})`} />
        ))}
        <circle r="7.6" />
      </g>
      <circle cx="16" cy="16" r="3.3" fill={BRAND.primaryDark} />
    </svg>
  );
}
