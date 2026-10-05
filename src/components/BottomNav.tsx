import { Icon } from './ui';

export type Tab = 'map' | 'observations' | 'compass' | 'settings';

const TABS: { id: Tab; label: string; icon: 'map' | 'list' | 'compass' | 'settings' }[] = [
  { id: 'map', label: 'Map', icon: 'map' },
  { id: 'observations', label: 'Observations', icon: 'list' },
  { id: 'compass', label: 'Compass', icon: 'compass' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export function BottomNav({ tab, onTab, count }: { tab: Tab; onTab(t: Tab): void; count: number }) {
  return (
    <nav className="glass tabbar z-[1150] shrink-0 pb-[env(safe-area-inset-bottom)]" aria-label="Sections">
      <div className="grid grid-cols-4">
        {TABS.map((t) => (
          <button key={t.id} className="nav-btn" aria-current={tab === t.id ? 'page' : undefined} onClick={() => onTab(t.id)}>
            <span className="relative">
              <Icon name={t.icon} className="h-[26px] w-[26px]" />
              {t.id === 'observations' && count > 0 && (
                <span className="num absolute -top-1.5 -right-3.5 min-w-[18px] rounded-full bg-accent px-1.5 text-center text-[11px] leading-[18px] !text-accent-ink">
                  {count}
                </span>
              )}
            </span>
            <span className="max-w-full truncate px-1">{t.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
