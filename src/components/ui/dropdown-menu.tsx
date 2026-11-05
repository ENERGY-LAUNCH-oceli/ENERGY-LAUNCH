import * as Menu from '@radix-ui/react-dropdown-menu';
import * as React from 'react';
import { cn } from '@/utils/cn';

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;

export const DropdownMenuContent = React.forwardRef<React.ElementRef<typeof Menu.Content>, React.ComponentPropsWithoutRef<typeof Menu.Content>>(
  ({ className, sideOffset = 8, align = 'end', ...props }, ref) => (
    <Menu.Portal>
      <Menu.Content
        ref={ref}
        sideOffset={sideOffset}
        align={align}
        className={cn('z-50 min-w-56 rounded-md border border-border bg-surface p-1 shadow-md data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95', className)}
        {...props}
      />
    </Menu.Portal>
  ),
);
DropdownMenuContent.displayName = 'DropdownMenuContent';

export const DropdownMenuItem = React.forwardRef<React.ElementRef<typeof Menu.Item>, React.ComponentPropsWithoutRef<typeof Menu.Item>>(({ className, ...props }, ref) => (
  <Menu.Item
    ref={ref}
    className={cn('flex cursor-pointer select-none items-center gap-2.5 rounded-sm px-3 py-2 text-body-sm outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-surface-secondary data-[disabled]:opacity-45 [&_svg]:size-4 [&_svg]:text-text-muted', className)}
    {...props}
  />
));
DropdownMenuItem.displayName = 'DropdownMenuItem';

export const DropdownMenuLabel = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof Menu.Label>) => <Menu.Label className={cn('px-3 py-2', className)} {...p} />;
export const DropdownMenuSeparator = () => <Menu.Separator className="my-1 h-px bg-border" />;
