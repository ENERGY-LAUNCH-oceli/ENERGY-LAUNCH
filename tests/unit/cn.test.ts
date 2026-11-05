import { describe, expect, it } from 'vitest';
import { cn } from '@/utils/cn';

describe('cn', () => {
  it('не удаляет цвет текста при кастомном размере шрифта', () => {
    const out = cn('text-primary-foreground', 'text-body-sm');
    expect(out).toContain('text-primary-foreground');
    expect(out).toContain('text-body-sm');
  });
  it('разрешает конфликт размеров шрифта', () => {
    expect(cn('text-body', 'text-caption')).toBe('text-caption');
  });
});
