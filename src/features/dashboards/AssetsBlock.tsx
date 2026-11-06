import { Battery, Sun } from 'lucide-react';
import { DIAGNOSIS } from '@/features/telemetry-validation/labels';
import type { DashboardBlockConfig, PassportAsset, SignalReport } from '@/types';
import { cn } from '@/utils/cn';
import { Widget } from './BlockFrame';
import { num, type DashboardData } from './data';

const TONE: Record<string, string> = { success: 'text-status-completed', error: 'text-status-blocked', warning: 'text-warning', info: 'text-info', neutral: 'text-text-secondary' };

/** Блок 2. Текущие активы: PV и батареи паспорта, мощность, SoC, актуальность, состояние. */
export function AssetsBlock({ block, data }: { block: DashboardBlockConfig; data: DashboardData }) {
  const w = block.widgets;
  const r = data.telemetry;
  const assets = data.passport?.assets ?? [];
  if (!assets.length) return <p className="text-body-sm text-text-muted">В паспорте object.json нет активов PV или Battery.</p>;
  const sig = (name: string): SignalReport | undefined => r?.signals.find((s) => s.signal === name);
  const groups: { type: 'PV' | 'BATTERY'; title: string; icon: typeof Sun; on: boolean }[] = [
    { type: 'PV', title: 'PV-установки', icon: Sun, on: !!w.pv_list && block.filter !== 'BATTERY' },
    { type: 'BATTERY', title: 'Батареи', icon: Battery, on: !!w.battery_list && block.filter !== 'PV' },
  ];
  const showPower = w.current_power && block.metrics.includes('power');
  const showSoc = w.soc && block.metrics.includes('soc');
  const ref = block.period === '48H' ? `окно 48 ч до ${r?.checkPoint.slice(11, 16) ?? '–'} UTC` : `точка проверки ${r?.checkPoint.slice(0, 16).replace('T', ' ') ?? '–'} UTC`;

  const row = (a: PassportAsset) => {
    const p = sig(`${a.prefix}.power_kW`);
    const soc = sig(`${a.prefix}.SOC_%`);
    const diag = p ? DIAGNOSIS[p.diagnosis] : null;
    const last = data.latest.get(a.assetId);
    return (
      <tr key={a.assetId} className="border-b border-border last:border-0" data-dashboard-asset={a.assetId}>
        <td className="py-2 pr-3">
          <span className="font-medium">{a.assetId}</span>
          <span className="block font-mono text-[11px] text-text-muted">{a.prefix}</span>
        </td>
        {showPower && <td className="px-3 text-right font-mono">{p?.lastValue !== null && p?.lastValue !== undefined ? `${num(p.lastValue, 1)} кВт` : '–'}</td>}
        {showSoc && <td className="px-3 text-right font-mono">{a.type === 'BATTERY' ? (soc?.lastValue !== null && soc?.lastValue !== undefined ? `${num(soc.lastValue, 0)} %` : '–') : <span className="text-text-muted">н/п</span>}</td>}
        {w.telemetry_freshness && (
          <td className={cn('px-3 font-mono text-caption', p?.ageMinutes !== null && p?.ageMinutes !== undefined && p.ageMinutes <= 30 ? 'text-status-completed' : 'text-status-blocked')}>
            {p?.ageMinutes !== null && p?.ageMinutes !== undefined ? `${p.ageMinutes} мин` : 'нет данных'}
          </td>
        )}
        {w.completeness && <td className="px-3 text-right font-mono text-caption">{p ? `${num(p.completenessPct, 1)} %` : '–'}</td>}
        {w.equipment_state && (
          <td className="pl-3 text-caption">
            <span className={cn('font-medium', diag ? TONE[diag.tone] : 'text-text-muted')}>{diag?.label ?? 'нет телеметрии'}</span>
            {last && <span className="block text-text-muted">управление: {last.state === 'PASSED' ? 'подтверждено' : 'не подтверждено'}</span>}
          </td>
        )}
      </tr>
    );
  };

  return (
    <>
      <p className="text-caption text-text-muted">Значения из telemetry.csv · {ref}</p>
      {groups
        .filter((g) => g.on)
        .map((g) => {
          const list = assets.filter((a) => a.type === g.type);
          const Icon = g.icon;
          return (
            <Widget key={g.type} title={`${g.title} · ${list.length}`}>
              {!list.length ? (
                <p className="text-caption text-text-muted">Нет в паспорте объекта – не применимо.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-body-sm [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
                    <thead>
                      <tr className="border-b border-border text-left font-mono text-[11px] uppercase tracking-[0.06em] text-text-muted">
                        <th className="py-1.5 pr-3 font-normal"><Icon className="mr-1 inline size-3.5" aria-hidden />Актив</th>
                        {showPower && <th className="px-3 text-right font-normal">Мощность</th>}
                        {showSoc && <th className="px-3 text-right font-normal">SoC</th>}
                        {w.telemetry_freshness && <th className="px-3 font-normal">Актуальность</th>}
                        {w.completeness && <th className="px-3 text-right font-normal">Полнота 48 ч</th>}
                        {w.equipment_state && <th className="pl-3 font-normal">Состояние</th>}
                      </tr>
                    </thead>
                    <tbody>{list.map(row)}</tbody>
                  </table>
                </div>
              )}
            </Widget>
          );
        })}
      <p className="text-caption text-text-muted">Отсутствие телеметрии не доказывает неисправность оборудования.</p>
    </>
  );
}
