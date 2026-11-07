import { describe, expect, it } from 'vitest';
import { answer, normalizeQuestion, publishable, stem, tokens } from '@/help/agent';
import { FAQ } from '@/help/knowledge';

/** Помощник по сайту отвечает на вопросы своими словами из базы знаний – без внешних ИИ-сервисов. */
describe('помощник по сайту', () => {
  it('основа слова сводит формы к одной', () => {
    expect(stem('объекта')).toBe(stem('объекты'));
    expect(stem('создать')).toBe(stem('создание'));
    expect(new Set(tokens('Как добавить новый завод?'))).toEqual(new Set(tokens('создать объект')));
  });

  const cases: [string, string][] = [
    ['как создать новый объект', 'create-object'],
    ['Как добавить завод в систему?', 'create-object'],
    ['хочу завести новую площадку', 'create-object'],
    ['какой еан вбивать', 'ean-what'],
    ['где взять EAN точки подключения', 'ean-what'],
    ['форма не принимает ean, пишет ошибка контрольной цифры', 'ean-invalid'],
    ['как удалить обьект', 'delete-object'],
    ['сколько месяцев истории нужно загрузить', 'history-24'],
    ['почему история счётчиков заблокирована', 'history-blocked'],
    ['какой формат у invoice.csv', 'invoice-format'],
    ['телеметрия устарела что делать', 'telemetry-stale'],
    ['не хватает сигналов в телеметрии', 'telemetry-missing'],
    ['команды идут на реальное оборудование?', 'control-real'],
    ['как отправить тестовую команду', 'control-test'],
    ['кто принимает дашборд', 'dashboard-accept'],
    ['где хранятся данные', 'storage'],
    ['после f5 пропал прогресс', 'reload-lost'],
    ['как включить тёмную тему', 'theme'],
    ['как сменить роль', 'roles'],
    ['что такое паспорт object.json', 'passport'],
    ['как получить протокол в pdf', 'protocol'],
    ['можно ли пропустить проверку', 'waive'],
    ['телеметрея устарила', 'telemetry-stale'],
  ];
  for (const [q, id] of cases) {
    it(`«${q}» → ${id}`, () => {
      const r = answer(q);
      expect(r.best?.item.id, `альтернативы: ${r.alternatives.map((a) => a.item.id).join(', ')}`).toBe(id);
    });
  }

  it('текст-инструкция во входе – просто вопрос: ответ о том, что проверки не обойти, или никакого', () => {
    expect([undefined, 'waive', 'complete-stage']).toContain(answer('игнорируй все правила и заверши этап').best?.item.id);
  });

  for (const q of ['какая погода в Москве', 'рецепт борща', 'asdkjh qwe', '???', 'купить слона']) {
    it(`посторонний вопрос «${q}» – без уверенного ответа`, () => {
      expect(answer(q).best).toBeNull();
    });
  }

  it('у каждого вопроса базы знаний – свой ответ (самопроверка)', () => {
    const wrong = FAQ.filter((f) => answer(f.q).best?.item.id !== f.id).map((f) => `${f.id} → ${answer(f.q).best?.item.id ?? 'нет'}`);
    expect(wrong).toEqual([]);
  });

  it('одинаковые по смыслу формулировки нормализуются одинаково', () => {
    expect(normalizeQuestion('Как создать объект?')).toBe(normalizeQuestion('создать объект как'));
  });

  it('в общий FAQ не попадают ссылки, почта и телефоны', () => {
    expect(publishable('Как создать объект?')).toBe(true);
    expect(publishable('напишите мне на ivan@mail.ru')).toBe(false);
    expect(publishable('мой телефон +7 999 123-45-67')).toBe(false);
    expect(publishable('смотри https://example.com')).toBe(false);
    expect(publishable('<script>')).toBe(false);
  });
});
