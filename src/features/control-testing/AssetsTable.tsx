import type { ControlAsset, ControlTestCommand } from '@/types';
import { cn } from '@/utils/cn';
import { CommandStateBadge } from './CommandStateBadge';
import { KIND_LABEL, kw } from './labels';

const TH = 'font-mono text-[11px] font-normal uppercase tracking-[0.06em] text-text-muted';

/** Управляемые активы: тип, текущая мощность, состояние, сигналы управления, контроллер, последний тест. */
export function AssetsTable({ assets, latest, onSelect }: { assets: ControlAsset[]; latest: Map<string, ControlTestCommand>; onSelect: (commandId: string) => void }) {
  return (
    <section id="assets" aria-labelledby="assets-title" className="scroll-mt-24 overflow-hidden rounded-lg border border-border bg-surface">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-3">
        <h2 id="assets-title" className="text-h3">
          Управляемые активы
        </h2>
        <span className="text-caption text-text-muted">по паспорту object.json · состояние стенда имитатора</span>
      </header>
      {!assets.length ? (
        <p className="px-5 py-5 text-body-sm text-text-secondary">В паспорте нет активов PV или Battery – тесты управления не применимы.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-body-sm" data-testid="control-assets">
            <thead>
              <tr className={cn('border-b border-border text-left', TH)}>
                <th className="py-2.5 pl-5 pr-3">Актив</th>
                <th className="px-3">Тип</th>
                <th className="px-3 text-right">Текущая мощность</th>
                <th className="px-3">Состояние</th>
                <th className="px-3">Сигналы управления</th>
                <th className="px-3">Контроллер</th>
                <th className="py-2.5 pl-3 pr-5">Последний тест</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => {
                const last = latest.get(a.assetId);
                return (
                  <tr key={a.assetId} className="border-b border-border align-top last:border-0" data-asset={a.assetId}>
                    <td className="py-3 pl-5 pr-3">
                      <span className="font-medium">{a.assetId}</span>
                      <span className="block font-mono text-[11px] text-text-muted">{a.prefix}</span>
                    </td>
                    <td className="px-3 py-3">
                      {KIND_LABEL[a.kind]}
                      <span className="block text-caption text-text-muted">номинал {kw(a.bench.ratedPowerKw, 0)}</span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-caption">
                      {kw(a.bench.currentPowerKw, 2)}
                      {a.bench.socPct !== null && <span className="block text-text-muted">SoC {a.bench.socPct} %</span>}
                    </td>
                    <td className="px-3 py-3 text-caption">
                      {!a.supported ? (
                        <span className="text-text-muted">Not Applicable</span>
                      ) : a.link === 'NO_COMMUNICATION' ? (
                        <span className="font-medium text-status-blocked">Нет связи по этапу 2</span>
                      ) : (
                        <span className="text-status-completed">Готов к тесту</span>
                      )}
                      {a.notSupportedReason && <span className="block max-w-[220px] text-text-muted">{a.notSupportedReason}</span>}
                    </td>
                    <td className="px-3 py-3 font-mono text-[11px] leading-5 text-text-secondary">
                      {a.signals.sent && <span className="block">{a.signals.sent}</span>}
                      <span className="block">{a.signals.received}</span>
                      <span className="block text-text-muted">{a.signals.actual}</span>
                    </td>
                    <td className="px-3 py-3 text-caption">
                      {a.bench.controller === 'ONLINE' ? <span className="text-text-secondary">Online · имитатор</span> : <span className="font-medium text-status-blocked">Нет ответа</span>}
                    </td>
                    <td className="py-3 pl-3 pr-5">
                      {last ? (
                        <button type="button" onClick={() => onSelect(last.commandId)} className="flex flex-col items-start gap-0.5 text-left hover:underline">
                          <CommandStateBadge state={last.state} />
                          <span className="font-mono text-[11px] text-text-muted">{last.commandId}</span>
                        </button>
                      ) : (
                        <span className="text-caption text-text-muted">{a.supported ? 'не проводился' : '–'}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
