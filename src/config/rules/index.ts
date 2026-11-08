import type { RulesConfig } from '@/types';
import { rulesConfigSchema } from '@/schemas/rules-config.schema';
import { RULESET_V1 } from './ruleset.v1';
import { RULESET_V1_1 } from './ruleset.v1_1';
import { RULESET_V1_2 } from './ruleset.v1_2';
import { RULESET_V1_3 } from './ruleset.v1_3';
import { RULESET_V1_4 } from './ruleset.v1_4';
import { RULESET_V1_5 } from './ruleset.v1_5';
import { RULESET_V1_6 } from './ruleset.v1_6';

/** Реестр всех версий наборов правил. Старые версии не удаляются – сессии ссылаются на них. */
export const RULESETS: Readonly<Record<string, RulesConfig>> = {
  [RULESET_V1.version]: RULESET_V1,
  [RULESET_V1_1.version]: RULESET_V1_1,
  [RULESET_V1_2.version]: RULESET_V1_2,
  [RULESET_V1_3.version]: RULESET_V1_3,
  [RULESET_V1_4.version]: RULESET_V1_4,
  [RULESET_V1_5.version]: RULESET_V1_5,
  [RULESET_V1_6.version]: RULESET_V1_6,
};

export const DEFAULT_RULESET_VERSION = RULESET_V1_6.version;

/** Активный набор правил (по умолчанию). */
export const ACTIVE_RULESET = RULESET_V1_6;

export class UnknownRulesetError extends Error {
  constructor(version: string) {
    super(`Неизвестная версия набора правил: ${version}`);
    this.name = 'UnknownRulesetError';
  }
}

/** Возвращает набор правил по версии (по умолчанию – активный). */
export function getRuleset(version: string = DEFAULT_RULESET_VERSION): RulesConfig {
  const ruleset = RULESETS[version];
  if (!ruleset) throw new UnknownRulesetError(version);
  return ruleset;
}

/** Проверяет внешний (например, загруженный из JSON) набор правил. */
export function parseRuleset(input: unknown): RulesConfig {
  return rulesConfigSchema.parse(input);
}

export { RULESET_V1, RULESET_V1_1, RULESET_V1_2, RULESET_V1_3, RULESET_V1_4, RULESET_V1_5, RULESET_V1_6 };
export { CASE4_CHECK_POINT } from './ruleset.v1_5';
