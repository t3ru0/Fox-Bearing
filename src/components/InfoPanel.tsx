import { Section } from './ui';

export function InfoPanel() {
  return (
    <Section title="Field notes">
      <ul className="space-y-2.5 text-[13px] leading-relaxed text-ink">
        <li>
          <span className="eyebrow mr-1.5">Accuracy</span>
          Bearings are approximate. RF reflections, antenna pattern, compass error, and GPS error can affect the result. Use
          multiple observation points and confirm the final location physically.
        </li>
        <li>
          <span className="eyebrow mr-1.5">Signal</span>
          Use the Yagi bearing to determine direction. RSSI can help compare measurements but reflections and multipath can
          produce misleading signal strengths.
        </li>
        <li>
          <span className="eyebrow mr-1.5">Geometry</span>
          Bearings that cross near 90° give the tightest fix. Readings from almost the same direction barely help.
        </li>
        <li>
          <span className="eyebrow mr-1.5">Offline</span>
          After one visit the app opens without signal. Map tiles appear offline only for areas you have already viewed; no
          large map areas are downloaded automatically. Pan around the hunt area while you still have data.
        </li>
      </ul>
    </Section>
  );
}
