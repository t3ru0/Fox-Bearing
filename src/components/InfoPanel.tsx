import { Section } from './ui';

export function InfoPanel() {
  return (
    <Section title="Field notes">
      <ul className="space-y-3 text-[14px] leading-[1.43] text-ink">
        <li>
          <strong className="mr-1 font-semibold text-ink-strong">Accuracy</strong>
          Bearings are approximate. RF reflections, antenna pattern, compass error, and GPS error can affect the result. Use
          multiple observation points and confirm the final location physically.
        </li>
        <li>
          <strong className="mr-1 font-semibold text-ink-strong">Signal</strong>
          Use the Yagi bearing to determine direction. RSSI can help compare measurements but reflections and multipath can
          produce misleading signal strengths.
        </li>
        <li>
          <strong className="mr-1 font-semibold text-ink-strong">Geometry</strong>
          Bearings that cross near 90° give the tightest fix. Readings from almost the same direction barely help.
        </li>
        <li>
          <strong className="mr-1 font-semibold text-ink-strong">Offline</strong>
          After one visit the app opens without signal. Map tiles appear offline only for areas you have already viewed; no
          large map areas are downloaded automatically. Pan around the hunt area while you still have data.
        </li>
      </ul>
    </Section>
  );
}
