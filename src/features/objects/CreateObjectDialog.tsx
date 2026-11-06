import * as React from 'react';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { EMPTY_DRAFT, MAX_ASSETS, assetRange, eanFix, suggestCode, validateDraft, type DraftErrors, type UserObjectDraft } from '@/data/objects';
import { useLaunchStore } from '@/store';

/** Добавление объекта: паспорт (как object.json) – из формы; данные этапов загружаются после создания. */
export function CreateObjectDialog({ trigger }: { trigger?: React.ReactNode }) {
  const createObject = useLaunchStore((s) => s.createObject);
  const actor = useLaunchStore((s) => s.actor);
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<UserObjectDraft>(EMPTY_DRAFT);
  const [codeTouched, setCodeTouched] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const errors: DraftErrors = submitted ? validateDraft(draft) : {};

  const reset = () => {
    setDraft({ ...EMPTY_DRAFT, responsible: actor });
    setCodeTouched(false);
    setSubmitted(false);
  };
  const onOpenChange = (v: boolean) => {
    if (v) reset();
    setOpen(v);
  };
  const set = <K extends keyof UserObjectDraft>(key: K, value: UserObjectDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value, ...(key === 'name' && !codeTouched ? { code: suggestCode(String(value)) } : {}) }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(validateDraft(draft)).length) return;
    const entry = createObject(draft);
    setOpen(false);
    navigate(ROUTES.objectSection(entry.id, 'launch'));
  };

  const text = (key: keyof UserObjectDraft, label: string, opts: { required?: boolean; placeholder?: string; hint?: string; mono?: boolean; inputMode?: 'numeric'; maxLength?: number } = {}) => (
    <Field label={label} htmlFor={`obj-${key}`} required={opts.required} error={errors[key]} hint={opts.hint}>
      <Input
        id={`obj-${key}`}
        value={String(draft[key])}
        onChange={(e) => {
          if (key === 'code') setCodeTouched(true);
          set(key, (key === 'code' ? e.target.value.toUpperCase() : e.target.value) as never);
        }}
        placeholder={opts.placeholder}
        aria-invalid={!!errors[key]}
        inputMode={opts.inputMode}
        maxLength={opts.maxLength}
        className={opts.mono ? 'font-mono tabular' : undefined}
        autoComplete="off"
      />
    </Field>
  );
  const count = (key: 'pvCount' | 'batteryCount', label: string) => (
    <Field label={label} htmlFor={`obj-${key}`} error={errors[key]}>
      <Input id={`obj-${key}`} type="number" min={0} max={MAX_ASSETS} step={1} value={draft[key]} onChange={(e) => set(key, e.target.value === '' ? 0 : Number(e.target.value))} aria-invalid={!!errors[key]} className="tabular" />
    </Field>
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      trigger={
        trigger ?? (
          <Button data-testid="add-object">
            <Plus /> Добавить объект
          </Button>
        )
      }
      title="Новый объект"
      description="Паспорт объекта: те же поля, что в object.json. После создания загрузите историю счётчиков и телеметрию на страницах этапов."
      className="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Отмена
          </Button>
          <Button type="submit" form="create-object-form" data-testid="create-object-submit">
            Создать объект
          </Button>
        </>
      }
    >
      <form id="create-object-form" onSubmit={submit} noValidate className="flex flex-col gap-6">
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-label text-text-muted">Объект</legend>
          <div className="sm:col-span-2">{text('name', 'Название', { required: true, placeholder: 'Например, Кампус «Южный»' })}</div>
          {text('code', 'Код', { required: true, placeholder: 'OBJ-007', hint: 'Подставляется из названия, можно изменить', mono: true, maxLength: 32 })}
          {text('kind', 'Тип объекта', { placeholder: 'Офисное здание' })}
          {text('responsible', 'Ответственный за запуск', { required: true })}
        </fieldset>
        <fieldset className="grid gap-4 sm:grid-cols-[1fr_1fr_8rem]">
          <legend className="mb-3 text-label text-text-muted">Адрес</legend>
          {text('street', 'Улица, дом', { placeholder: 'Rue Exemple 1' })}
          {text('city', 'Город', { required: true })}
          {text('postalCode', 'Индекс', { inputMode: 'numeric', maxLength: 10 })}
        </fieldset>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-label text-text-muted">Подключение к сети</legend>
          {(['eanOfftake', 'eanInjection'] as const).map((key) => {
            const fix = eanFix(draft[key]);
            return (
              <div key={key} className="flex flex-col gap-1.5">
                {text(key, key === 'eanOfftake' ? 'EAN точки отбора' : 'EAN точки отдачи', { required: true, mono: true, inputMode: 'numeric', maxLength: 18, placeholder: '5414…', hint: 'Из договора подключения или счёта: 18 цифр' })}
                {fix && (
                  <button type="button" onClick={() => set(key, fix)} className="self-start text-caption font-medium text-accent-strong hover:underline" data-testid={`${key}-fix`}>
                    Подставить контрольную цифру: <span className="font-mono">{fix}</span>
                  </button>
                )}
              </div>
            );
          })}
        </fieldset>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-label text-text-muted">Оборудование</legend>
          {count('pvCount', 'Солнечные установки (PV)')}
          {count('batteryCount', 'Батареи')}
          <p className="text-caption text-text-muted sm:col-span-2">
            Оборудование в паспорте: {[assetRange('PV', Math.min(MAX_ASSETS, draft.pvCount || 0)), assetRange('Battery', Math.min(MAX_ASSETS, draft.batteryCount || 0))].filter(Boolean).join(', ') || 'нет'}. До {MAX_ASSETS.toLocaleString('ru-RU')} установок каждого типа.
          </p>
        </fieldset>
      </form>
    </Modal>
  );
}
