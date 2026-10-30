import React from 'react';

interface ProgressRingProps {
  progressPercent: number; // 0 to 100
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  progressPercent,
  size = 140,
  strokeWidth = 12,
  label,
  sublabel,
}) => {
  const clamped = Math.min(100, Math.max(0, Math.round(progressPercent)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className="flex flex-col items-center justify-center relative select-none"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label || 'Syllabus Progress'}
    >
      <svg
        width={size}
        height={size}
        className="transform -rotate-90 origin-center"
      >
        <defs>
          <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2DD4A7" />
            <stop offset="100%" stopColor="#4EA8FF" />
          </linearGradient>
        </defs>
        {/* Track (on --surface-2) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={strokeWidth}
        />
        {/* Fill */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#progress-gradient)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {/* Center Text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2">
        <span className="font-heading font-bold text-2xl text-ink leading-none tracking-tight">
          {clamped}%
        </span>
        {sublabel ? (
          <span className="text-[11px] font-medium text-muted mt-1 leading-tight">
            {sublabel}
          </span>
        ) : null}
      </div>
    </div>
  );
};
