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
    hex: '#2563EB', // Cobalt Blue
    bgSoft: '#EFF6FF',
    border: '#BFDBFE',
    text: '#1D4ED8',
  },
  '2': {
    hex: '#0D9488', // Teal
    bgSoft: '#F0FDFA',
    border: '#99F6E4',
    text: '#0F766E',
  },
  '3': {
    hex: '#0284C7', // Sky Blue
    bgSoft: '#F0F9FF',
    border: '#BAE6FD',
    text: '#0369A1',
  },
  '4': {
    hex: '#D97706', // Amber
    bgSoft: '#FFFBEB',
    border: '#FDE68A',
    text: '#B45309',
  },
  '5': {
    hex: '#7C3AED', // Lavender / Violet
    bgSoft: '#F5F3FF',
    border: '#DDD6FE',
    text: '#6D28D9',
  },
  '6': {
    hex: '#059669', // Emerald
    bgSoft: '#ECFDF5',
    border: '#A7F3D0',
    text: '#047857',
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
