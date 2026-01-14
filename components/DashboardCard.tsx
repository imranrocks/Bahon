
import React from 'react';

interface Props {
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  colorClass?: string;
}

export const DashboardCard: React.FC<Props> = ({ title, value, unit, icon, trend, colorClass = "text-primary-500" }) => {
  return (
    <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center justify-between mb-3">
        <span className={`p-2 rounded-xl bg-opacity-10 ${colorClass.replace('text', 'bg')}`}>
          <div className={colorClass}>{icon}</div>
        </span>
        {trend && (
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${trend.value >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {trend.value > 0 ? '+' : ''}{trend.value}% {trend.label}
          </span>
        )}
      </div>
      <div>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">{title}</p>
        <div className="flex items-baseline gap-1">
          <h3 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{value}</h3>
          {unit && <span className="text-zinc-400 dark:text-zinc-500 text-xs font-semibold">{unit}</span>}
        </div>
      </div>
    </div>
  );
};
