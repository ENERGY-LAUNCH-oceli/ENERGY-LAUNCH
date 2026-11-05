import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as React from 'react';
import { cn } from '@/utils/cn';

export const Tabs = TabsPrimitive.Root;

/** variant="line" — подчёркивание бирюзовым (навигация по разделам); "pill" — сегментированный переключатель. */
const TabsVariantContext = React.createContext<'line' | 'pill'>('line');

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & { variant?: 'line' | 'pill' }
>(({ className, variant = 'line', ...props }, ref) => (
  <TabsVariantContext.Provider value={variant}>
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        'inline-flex items-center',
        variant === 'line' ? 'w-full gap-6 overflow-x-auto shadow-[inset_0_-1px_0] shadow-border [scrollbar-width:none]' : 'gap-1 rounded-pill border border-border bg-surface-sunken p-1',
        className,
      )}
      {...props}
    />
  </TabsVariantContext.Provider>
));
TabsList.displayName = 'TabsList';

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & { count?: number }
>(({ className, children, count, ...props }, ref) => {
  const variant = React.useContext(TabsVariantContext);
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        'inline-flex items-center gap-2 whitespace-nowrap text-body-sm font-semibold text-text-secondary transition-colors duration-fast hover:text-text-primary disabled:pointer-events-none disabled:opacity-45',
        variant === 'line'
          ? 'shrink-0 border-b-2 border-transparent pb-3 pt-1 data-[state=active]:border-accent data-[state=active]:text-text-primary'
          : 'h-8 rounded-pill px-4 data-[state=active]:bg-surface data-[state=active]:text-text-primary data-[state=active]:shadow-xs',
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined && <span className="tabular rounded-pill bg-surface-sunken px-1.5 text-caption text-text-secondary">{count}</span>}
    </TabsPrimitive.Trigger>
  );
});
TabsTrigger.displayName = 'TabsTrigger';

export const TabsContent = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Content>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>>(
  ({ className, ...props }, ref) => <TabsPrimitive.Content ref={ref} className={cn('pt-5 focus-visible:ring-0', className)} {...props} />,
);
TabsContent.displayName = 'TabsContent';
