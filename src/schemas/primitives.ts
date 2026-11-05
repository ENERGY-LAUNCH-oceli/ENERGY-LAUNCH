import { z } from 'zod';
import { CONFIRMATION_ROLES, SEVERITIES } from '@/types';

export const idSchema = z.string().min(1);
/** ISO 8601 с указанием смещения или `Z`. */
export const isoDateTimeSchema = z.iso.datetime({ offset: true });
export const isoDateSchema = z.iso.date();
export const severitySchema = z.enum(SEVERITIES);
export const confirmationRoleSchema = z.enum(CONFIRMATION_ROLES);
export const percentSchema = z.number().min(0).max(100);
export const positiveNumberSchema = z.number().positive();
