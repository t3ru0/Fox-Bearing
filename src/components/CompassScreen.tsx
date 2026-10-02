import type { ComponentProps } from 'react';
import { MarkFlow } from './MarkFlow';
import { Note } from './ui';

type Props = Omit<ComponentProps<typeof MarkFlow>, 'variant' | 'onCancel'>;

export function CompassScreen(props: Props) {
  return (
    <div className="space-y-3 p-3">
      <section className="card p-4">
        <MarkFlow variant="screen" {...props} />
      </section>
      <Note>
        Phone compasses are approximate and are disturbed by metal, vehicles, and the radio itself. Hold the phone flat along the
        Yagi boom and check it against a known landmark. The heading is read as magnetic and corrected by your declination
        setting. The gold marker on the dial shows the direction to the current fox estimate.
      </Note>
    </div>
  );
}
