import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge должен знать о кастомной типографической шкале: иначе `text-body-sm`
 * считается цветом текста и удаляет `text-primary-foreground` при слиянии классов.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['display', 'h1', 'h2', 'h3', 'body-lg', 'body', 'body-sm', 'caption', 'label', 'numeric', 'numeric-sm'] }],
      shadow: [{ shadow: ['xs', 'md', 'lg'] }],
      rounded: [{ rounded: ['xs', 'sm', 'md', 'lg', 'xl', 'pill'] }],
    },
  },
});

/** Объединение классов Tailwind (shadcn/ui). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
