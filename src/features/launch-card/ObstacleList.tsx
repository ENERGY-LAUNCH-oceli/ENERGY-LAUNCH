import { BlockerCard } from '@/components/launch';
import { blockerHref } from '@/config/blocker-links';
import { useLaunchStore } from '@/store';
import type { ObstacleView } from './model';

/** Препятствия этапа с точным местом и следующим действием. */
export function ObstacleList({ items }: { items: ObstacleView[] }) {
  const objectId = useLaunchStore((s) => s.session?.objectId);
  const open = items.filter((i) => i.blocker.status === 'OPEN');
  const closed = items.filter((i) => i.blocker.status !== 'OPEN');
  return (
    <div className="flex flex-col gap-2">
      {open.map((o) => (
        <BlockerCard key={o.blocker.id} blocker={o.blocker} location={o.location} {...(o.nextAction ? { nextAction: o.nextAction } : {})} {...(o.nextAction && objectId ? { nextActionHref: blockerHref(objectId, o.blocker.ruleId, o.blocker.stageId) } : {})} />
      ))}
      {closed.map((o) => (
        <BlockerCard key={o.blocker.id} blocker={o.blocker} />
      ))}
    </div>
  );
}
