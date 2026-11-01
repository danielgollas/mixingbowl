import { getComponent } from '../data/components';
import type { ComponentId } from '../data/types';

/** A short line of what's in a bowl. A span, so it can sit inside a link. */
export function BowlParts({ parts }: { parts: ComponentId[] }) {
  if (parts.length === 0) return null;
  return <span class="meta bowl-parts">{parts.map((id) => getComponent(id)?.name ?? id).join(' · ')}</span>;
}
