import React from 'react';

interface SubjectBadgeProps {
  name: string;
  colorKey: '1' | '2' | '3' | '4' | '5' | '6';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const subjectColorMap: Record<
  '1' | '2' | '3' | '4' | '5' | '6',
  { hex: string; bgSoft: string; border: string; text: string }
> = {
  '1': {
    hex: '#7C5CFF', // iris
    bgSoft: 'rgba(124, 92, 255, 0.16)',
    border: 'rgba(124, 92, 255, 0.3)',
    text: '#9377FF',
  },
  '2': {
    hex: '#2DD4A7', // mint
    bgSoft: 'rgba(45, 212, 167, 0.16)',
    border: 'rgba(45, 212, 167, 0.3)',
    text: '#2DD4A7',
  },
  '3': {
    hex: '#4EA8FF', // blue
    bgSoft: 'rgba(78, 168, 255, 0.16)',
    border: 'rgba(78, 168, 255, 0.3)',
    text: '#4EA8FF',
  },
  '4': {
    hex: '#FFB86B', // amber
    bgSoft: 'rgba(255, 184, 107, 0.16)',
    border: 'rgba(255, 184, 107, 0.3)',
    text: '#FFB86B',
  },
  '5': {
    hex: '#FF6B81', // rose
    bgSoft: 'rgba(255, 107, 129, 0.16)',
    border: 'rgba(255, 107, 129, 0.3)',
    text: '#FF6B81',
  },
  '6': {
    hex: '#F472B6', // pink
    bgSoft: 'rgba(244, 114, 182, 0.16)',
    border: 'rgba(244, 114, 182, 0.3)',
    text: '#F472B6',
  },
};

export const SubjectBadge: React.FC<SubjectBadgeProps> = ({
  name,
  colorKey,
  className = '',
  size = 'md',
}) => {
  const styles = subjectColorMap[colorKey] || subjectColorMap['1'];
  const initial = name ? name.trim().charAt(0).toUpperCase() : '?';

  const sizeClasses = {
    sm: 'text-xs py-0.5 px-2 gap-1.5',
    md: 'text-sm py-1 px-2.5 gap-2',
    lg: 'text-base py-1.5 px-3.5 gap-2.5',
  };

  const circleSizes = {
    sm: 'w-4 h-4 text-[10px]',
    md: 'w-5 h-5 text-xs',
    lg: 'w-6 h-6 text-sm',
  };

  return (
    <span
      className={`inline-flex items-center rounded-pill border font-medium ${sizeClasses[size]} ${className}`}
      style={{
        backgroundColor: styles.bgSoft,
        borderColor: styles.border,
        color: styles.text,
      }}
    >
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center font-bold rounded-full ${circleSizes[size]}`}
        style={{
          backgroundColor: styles.hex,
          color: '#0A0A16',
        }}
      >
        {initial}
      </span>
      <span className="truncate max-w-[140px] sm:max-w-[200px] font-semibold">{name}</span>
    </span>
  );
};
