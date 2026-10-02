import { type ComponentProps, useEffect, useRef } from 'react';
import { MarkFlow } from './MarkFlow';

type Props = Omit<ComponentProps<typeof MarkFlow>, 'variant' | 'onCancel'> & { title: string; onClose(): void };

export function MarkSheet({ title, onClose, onSave, ...flow }: Props) {
  const dlg = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (dlg.current && !dlg.current.open) dlg.current.showModal();
  }, []);
  return (
    <dialog ref={dlg} className="sheet" onClose={onClose} aria-labelledby="mark-title">
      <div className="flex max-h-[92dvh] flex-col">
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line-strong" aria-hidden />
        <header className="flex shrink-0 items-center justify-between px-5 pt-2 pb-2">
          <h2 id="mark-title" className="eyebrow !text-[12px] !text-ink-strong">{title}</h2>
          <button className="btn btn-ghost" onClick={() => dlg.current?.close()}>Close</button>
        </header>
        <div className="overflow-y-auto overscroll-contain px-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <MarkFlow
            variant="sheet"
            {...flow}
            onSave={(o) => {
              onSave(o);
              dlg.current?.close();
            }}
          />
        </div>
      </div>
    </dialog>
  );
}
