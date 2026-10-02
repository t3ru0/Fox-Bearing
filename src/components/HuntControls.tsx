import { useRef, useState } from 'react';
import type { Hunt } from '../types';
import {
  deleteSaved,
  downloadFile,
  fileSlug,
  huntToCSV,
  huntToJSON,
  listSaved,
  newHunt,
  parseHuntJSON,
  saveSnapshot,
} from '../lib/storage';
import { Note, Section } from './ui';

interface Props {
  hunt: Hunt;
  onReplace(h: Hunt): void;
  onRename(name: string): void;
  onClear(): void;
}

export function HuntControls({ hunt, onReplace, onRename, onClear }: Props) {
  const [saved, setSaved] = useState(() => listSaved());
  const [msg, setMsg] = useState<{ text: string; warn?: boolean } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const n = hunt.observations.length;

  const keepCurrent = () => {
    if (n) setSaved(saveSnapshot(hunt));
  };

  const startNew = () => {
    if (n && !confirm('Start a new hunt? The current one will be kept under Saved hunts.')) return;
    keepCurrent();
    onReplace(newHunt(hunt.settings));
    setMsg({ text: 'New hunt started.' });
  };

  const save = () => {
    const name = prompt('Name this hunt', hunt.name)?.trim();
    if (!name) return;
    onRename(name);
    setSaved(saveSnapshot({ ...hunt, name }));
    setMsg({ text: `Saved “${name}”.` });
  };

  const load = (h: Hunt) => {
    if (h.id === hunt.id) return;
    keepCurrent();
    onReplace(h);
    setMsg({ text: `Loaded “${h.name}”.` });
  };

  const importFile = async (f: File) => {
    try {
      const h = parseHuntJSON(await f.text());
      if (n && !confirm(`Replace the current hunt with “${h.name}” (${h.observations.length} bearings)? The current hunt will be kept under Saved hunts.`)) return;
      keepCurrent();
      onReplace(h);
      setMsg({ text: `Imported ${h.observations.length} bearings.` });
    } catch (e) {
      setMsg({ text: `Import failed: ${(e as Error).message}`, warn: true });
    }
  };

  return (
    <Section title="Hunt" aside={<span className="eyebrow max-w-[55%] truncate">{hunt.name}</span>}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <button className="btn" onClick={startNew}>New hunt</button>
        <button className="btn" onClick={save}>Save hunt</button>
        <button className="btn" onClick={() => file.current?.click()}>Import JSON</button>
        <button className="btn" disabled={!n} onClick={() => downloadFile(`${fileSlug(hunt)}.json`, huntToJSON(hunt), 'application/json')}>
          Export JSON
        </button>
        <button className="btn" disabled={!n} onClick={() => downloadFile(`${fileSlug(hunt)}.csv`, huntToCSV(hunt), 'text/csv')}>
          Export CSV
        </button>
        <button
          className="btn btn-danger"
          disabled={!n}
          onClick={() => confirm(`Clear this session and delete all ${n} observations? Export first if you need them. This cannot be undone.`) && onClear()}
        >
          Clear session
        </button>
      </div>
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) importFile(f);
          e.target.value = '';
        }}
      />
      {msg && <div className="mt-2.5"><Note tone={msg.warn ? 'warn' : 'muted'}>{msg.text}</Note></div>}

      {saved.length > 0 && (
        <div className="mt-4">
          <div className="eyebrow mb-1.5">Saved hunts</div>
          <ul className="divide-y divide-line rounded-[5px] border border-line">
            {saved.map((h) => (
              <li key={h.id} className="flex items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink-strong">{h.name}</div>
                  <div className="text-[11px] text-muted">
                    {h.observations.length} bearings · {new Date(h.updatedAt).toLocaleString()}
                  </div>
                </div>
                <button className="btn btn-ghost" onClick={() => load(h)} disabled={h.id === hunt.id}>
                  {h.id === hunt.id ? 'Open' : 'Load'}
                </button>
                <button
                  className="btn btn-ghost btn-danger"
                  onClick={() => confirm(`Delete saved hunt “${h.name}”?`) && setSaved(deleteSaved(h.id))}
                  aria-label={`Delete ${h.name}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-3">
        <Note>The current hunt saves automatically on this device. Export JSON to back it up or move it to another phone.</Note>
      </div>
    </Section>
  );
}
