import { ReactNode } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export default function Modal({ title, onClose, children, size = 'md' }: ModalProps) {
  const widthClass = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`bg-white rounded-xl shadow-2xl w-full ${widthClass} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 transition-colors">
            <XMarkIcon className="h-5 w-5 text-slate-600" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
