import { FIELD_LABELS, formatRuleLabel, formatRuleValue, GROUP_LABELS, RULE_HINTS, WIDGET_LABELS } from './rule-labels';

/** Параметры одной группы набора правил: список полей, состав панели по блокам или «название – значение». */
export function RuleValues({ values }: { values: Record<string, unknown> }) {
  return (
    <dl className="divide-y divide-border text-body-sm">
      {Object.entries(values).map(([k, v]) =>
        k === 'fields' && Array.isArray(v) ? (
          <div key={k} className="py-3">
            <dt className="text-caption font-medium text-text-primary">{formatRuleLabel(k)}</dt>
            <dd className="mt-1">
              {RULE_HINTS[k] && <span className="text-caption text-text-muted">{RULE_HINTS[k]}</span>}
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {v.map((field) => (
                  <li key={field.field} data-testid="rule-field-row" className="min-w-0 rounded-sm border border-border bg-surface-secondary px-3 py-2.5">
                    <span className="block break-words text-body-sm font-medium text-text-primary">
                      {FIELD_LABELS[field.field] ?? field.field}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-sm bg-surface-sunken px-2 py-0.5 text-caption text-text-secondary">{field.unit}</span>
                      <span className="rounded-sm bg-surface-sunken px-2 py-0.5 text-caption text-text-secondary">
                        {field.sign === 'NON_NEGATIVE' ? 'Не ниже 0' : field.sign === 'NON_POSITIVE' ? 'Не выше 0' : 'Знак не ограничен'}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ) : k === 'requiredWidgets' && v && typeof v === 'object' && !Array.isArray(v) ? (
          <div key={k} className="py-3">
            <dt className="text-caption font-medium text-text-primary">{formatRuleLabel(k)}</dt>
            <dd className="mt-1">
              {RULE_HINTS[k] && <span className="text-caption text-text-muted">{RULE_HINTS[k]}</span>}
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {Object.entries(v).map(([group, widgets]) => (
                  <li key={group} data-testid="dashboard-widget-group" className="min-w-0 rounded-sm border border-border bg-surface-secondary p-3">
                    <h4 className="text-caption font-medium text-text-primary">{GROUP_LABELS[group] ?? group}</h4>
                    <ul className="mt-2 grid gap-1">
                      {Array.isArray(widgets) && widgets.map((widget) => (
                        <li key={String(widget)} className="break-words text-caption text-text-secondary">
                          {WIDGET_LABELS[String(widget)] ?? String(widget)}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ) : (
          <div key={k} className="flex min-w-0 flex-col justify-between gap-1 py-2 sm:flex-row sm:gap-4">
            <dt className="min-w-0 text-caption text-text-secondary">
              {formatRuleLabel(k)}
              {RULE_HINTS[k] && <span className="mt-0.5 block text-text-muted">{RULE_HINTS[k]}</span>}
            </dt>
            <dd className={`min-w-0 break-words font-medium ${k === 'requiredWidgets' ? 'text-body-sm' : 'text-left tabular sm:text-right'}`}>
              {formatRuleValue(k, v)}
            </dd>
          </div>
        ),
      )}
    </dl>
  );
}
