/**
 * Плавное сворачивание: разметка одинакова в обоих состояниях. Иконки стоят на месте (по центру узкой панели),
 * подписи гаснут и обрезаются шириной панели. Состояние – атрибут data-collapsed у панели (группа sb).
 */
export const SB_LABEL = 'min-w-0 truncate whitespace-nowrap transition-[opacity,transform] duration-200 ease-out group-data-[collapsed=false]/sb:delay-100 group-data-[collapsed=true]/sb:-translate-x-1 group-data-[collapsed=true]/sb:opacity-0';
/** Строка панели: иконка 17 px по центру 40-пиксельной колонки свёрнутой панели. */
/** Нижняя часть панели – строки ниже, чтобы навигация помещалась без прокрутки. */
export const SB_ROW_SM = 'h-8';
export const SB_ROW = 'group/row relative flex h-9 w-full items-center gap-2.5 overflow-hidden rounded-sm px-[11.5px] text-body-sm text-text-secondary transition-colors duration-fast hover:bg-surface-hover hover:text-text-primary';
