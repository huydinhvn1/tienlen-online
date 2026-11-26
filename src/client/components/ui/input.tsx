import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils.ts';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-11 w-full rounded-xl border border-white/15 bg-black/25 px-3 text-base text-foreground outline-none placeholder:text-white/45 focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
