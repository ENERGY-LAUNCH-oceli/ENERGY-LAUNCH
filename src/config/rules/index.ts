import type { RulesConfig } from '@/types';
import { rulesConfigSchema } from '@/schemas/rules-config.schema';
import { RULESET_V1 } from './ruleset.v1';

/** Реестр всех версий наборов правил. Старые версии не удаляются — сессии ссылаются на них. */
export const RULESETS: Readonly<Record<string, RulesConfig>> = {
  [RULESET_V1.version]: RULESET_V1,
};

export const DEFAULT_RULESET_VERSION = RULESET_V1.version;

export class UnknownRulesetError extends Error {
  constructor(version: string) {
    super(`Неизвестная версия набора правил: ${version}`);
    this.name = 'UnknownRulesetError';
  }
}

/** Возвращает набор правил по версии (по умолчанию — активный). */
export function getRuleset(version: string = DEFAULT_RULESET_VERSION): RulesConfig {
  const ruleset = RULESETS[version];
  if (!ruleset) throw new UnknownRulesetError(version);
  return ruleset;
}

/** Проверяет внешний (например, загруженный из JSON) набор правил. */
export function parseRuleset(input: unknown): RulesConfig {
  return rulesConfigSchema.parse(input);
}

export { RULESET_V1 };
