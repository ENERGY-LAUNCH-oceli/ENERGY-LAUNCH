import { format, formatDistanceToNowStrict, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

export const formatDateTime = (iso: string): string => format(parseISO(iso), 'dd.MM.yyyy HH:mm', { locale: ru });
export const formatDate = (iso: string): string => format(parseISO(iso), 'dd.MM.yyyy', { locale: ru });
export const formatRelative = (iso: string): string => formatDistanceToNowStrict(parseISO(iso), { locale: ru, addSuffix: true });

const numberFmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
export const formatNumber = (value: number): string => numberFmt.format(value);
