
import React from 'react';
import { Bike } from '../src/types';

interface Props {
  bikes: Bike[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

export const BikeSelector: React.FC<Props> = ({ bikes, activeId, onSelect, onAdd }) => {
  return (
    <div className="flex gap-3 overflow-x-auto no-scrollbar py-4 px-1">
      {bikes.map((bike) => (
        <button
          key={bike.id}
          onClick={() => onSelect(bike.id)}
          className={`flex-shrink-0 px-5 py-3 rounded-2xl border transition-all ${
            activeId === bike.id 
              ? 'bg-primary-600 border-primary-600 text-white shadow-lg shadow-primary-500/30 ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-zinc-950' 
              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${activeId === bike.id ? 'bg-white/20' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </div>
            <div className="text-left">
              <p className="text-sm font-bold">{bike.name}</p>
              <p className="text-[10px] opacity-70 uppercase tracking-wider">{bike.model}</p>
            </div>
          </div>
        </button>
      ))}
      <button
        onClick={onAdd}
        className="flex-shrink-0 px-6 py-3 rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 hover:text-primary-500 hover:border-primary-500 transition-all flex items-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
        <span className="text-sm font-semibold">New Bike</span>
      </button>
    </div>
  );
};
