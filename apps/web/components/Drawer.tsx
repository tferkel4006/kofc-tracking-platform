'use client';
// Right-hand side drawer with a navy title bar and a gold edge. Escape or "Close" dismisses it.
import { useEffect, type ReactNode } from 'react';

export function Drawer({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <aside
      aria-label={title}
      className={`fixed inset-y-0 right-0 z-10 flex ${wide ? 'w-[40rem]' : 'w-[28rem]'} max-w-full flex-col border-l-8 border-gold bg-white shadow-xl`}
    >
      <header data-surface="navy" className="flex items-center justify-between gap-3 bg-navy px-4 py-3 text-white">
        <h2 className="font-serif text-lg font-bold">{title}</h2>
        <button type="button" onClick={onClose} className="font-bold underline">
          Close
        </button>
      </header>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">{children}</div>
    </aside>
  );
}
