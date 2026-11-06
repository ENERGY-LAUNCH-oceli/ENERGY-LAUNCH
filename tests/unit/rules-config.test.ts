import { describe, expect, it } from 'vitest';
import { ACTIVE_RULESET, getRuleset, parseRuleset, RULESETS, RULESET_V1, UnknownRulesetError } from '@/config/rules';
import { RULE_CATALOG } from '@/engine';
import { STAGE_IDS } from '@/types';

describe('конфигурация правил', () => {
  it('все наборы проходят схему', () => {
    for (const r of Object.values(RULESETS)) expect(parseRuleset(r)).toEqual(r);
    expect(ACTIVE_RULESET.controlTesting).toBeDefined();
  });

  it('отклоняет некорректные пороги', () => {
    expect(() => parseRuleset({ ...RULESET_V1, meterHistory: { ...RULESET_V1.meterHistory, minCompletenessPct: 120 } })).toThrow();
    expect(() =>
      parseRuleset({ ...RULESET_V1, control: { ...RULESET_V1.control, minIntervalBetweenCommandsSec: 1000, maxIntervalBetweenCommandsSec: 10 } }),
    ).toThrow();
  });

  it('неизвестная версия', () => {
    expect(() => getRuleset('0.0.0')).toThrow(UnknownRulesetError);
  });

  it('у каждого этапа есть правила и подтверждения', () => {
    for (const stage of STAGE_IDS) {
      expect(Object.values(RULE_CATALOG).some((r) => r.stageId === stage)).toBe(true);
      expect(RULESET_V1.confirmations[stage].length).toBeGreaterThan(0);
    }
  });

  it('configRef каждого правила указывает на существующий параметр', () => {
    for (const rule of Object.values(RULE_CATALOG)) {
      if (!rule.configRef) continue;
      // параметр ищется в наборе, где правило начинает действовать
      const value = rule.configRef.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], getRuleset(rule.sinceRuleset ?? RULESET_V1.version));
      expect(value, rule.id).not.toBeUndefined();
    }
  });
});
