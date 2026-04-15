import { cn } from '@/lib/utils';

interface CircularGaugeProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export default function CircularGauge({ value, size = 56, strokeWidth = 4, className }: CircularGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  const color = value >= 80
    ? 'hsl(var(--success))'
    : value >= 50
      ? 'hsl(var(--warning))'
      : 'hsl(var(--destructive))';

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--secondary))"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span
        className="absolute text-xs font-extrabold"
        style={{ color }}
      >
        {value}
      </span>
    </div>
  );
}
