import type { AccessAction, DemoRole } from '@/types';

/**
 * Матрица прав демонстрационных ролей. Проверяется в функциях движка и в действиях хранилища –
 * скрытая кнопка не даёт обойти запрет.
 */
export const ROLE_PERMISSIONS: Readonly<Record<DemoRole, readonly AccessAction[]>> = {
  LAUNCH_ENGINEER: ['dashboard.view', 'dashboard.edit', 'dashboard.publish', 'launch.manage'],
  OPERATOR: ['dashboard.view'],
  ACCEPTANCE_OFFICER: ['dashboard.view', 'dashboard.accept'],
};

export const can = (role: DemoRole, action: AccessAction): boolean => ROLE_PERMISSIONS[role].includes(action);

export const ROLE_TITLE: Record<DemoRole, string> = {
  LAUNCH_ENGINEER: 'Инженер запуска',
  OPERATOR: 'Оператор',
  ACCEPTANCE_OFFICER: 'Ответственный за приёмку',
};

export const ACTION_TITLE: Record<AccessAction, string> = {
  'dashboard.view': 'просмотр панели',
  'dashboard.edit': 'настройка панели',
  'dashboard.publish': 'публикация панели',
  'dashboard.accept': 'приёмка панели',
  'launch.manage': 'действия по этапам запуска',
};

export class AccessDeniedError extends Error {
  constructor(
    readonly role: DemoRole,
    readonly action: AccessAction,
  ) {
    super(`Нет прав: роль «${ROLE_TITLE[role]}» не может выполнять «${ACTION_TITLE[action]}»`);
    this.name = 'AccessDeniedError';
  }
}

/** Бросает AccessDeniedError, если у роли нет права. */
export function assertCan(role: DemoRole, action: AccessAction): void {
  if (!can(role, action)) throw new AccessDeniedError(role, action);
}
