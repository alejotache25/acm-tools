import { ComponentType } from 'react';

interface Tab {
  id: string;
  label: string;
  Icon?: ComponentType<{ className?: string }>;
}

interface TabNavProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
}

export default function TabNav({ tabs, active, onChange }: TabNavProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
            active === tab.id
              ? 'bg-white text-blue-600 shadow-md scale-105'
              : 'text-slate-800 hover:bg-slate-200'
          }`}
        >
          {tab.Icon && <tab.Icon className="h-4 w-4" />}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
