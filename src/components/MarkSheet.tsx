import { type ComponentProps, useEffect, useRef } from 'react';
import { MarkFlow } from './MarkFlow';
import { Icon } from './ui';

type Props = Omit<ComponentProps<typeof MarkFlow>, 'variant' | 'onCancel'> & { title: string; onClose(): void };

export function MarkSheet({ title, onClose, onSave, ...flow }: Props) {
  const dlg = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (dlg.current && !dlg.current.open) dlg.current.showModal();
  }, []);
  return (
    <dialog ref={dlg} className="sheet" onClose={onClose} aria-labelledby="mark-title">
      <div className="flex max-h-[92dvh] flex-col">
        <div className="mx-auto mt-2 h-[5px] w-9 shrink-0 rounded-full bg-line-strong/50" aria-hidden />
        <header className="grid shrink-0 grid-cols-[2.75rem_1fr_2.75rem] items-center px-3 pt-2 pb-2">
          <span aria-hidden />
          <h2 id="mark-title" className="truncate text-center text-[17px]">{title}</h2>
          <button className="close-btn justify-self-end" onClick={() => dlg.current?.close()} aria-label="Close">
            <Icon name="close" className="h-4 w-4" />
          </button>
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
