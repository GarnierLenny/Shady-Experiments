'use client';

import { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'md' | 'lg';
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-sm border-2 font-impact uppercase tracking-wider transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40',
        size === 'lg' ? 'px-8 py-4 text-xl' : 'px-5 py-2.5 text-base',
        variant === 'primary' &&
          'border-ember bg-ember text-night shadow-[0_4px_0_0_#7c1d12] hover:border-gold hover:bg-gold',
        variant === 'ghost' &&
          'border-dust bg-transparent text-sand hover:border-sand',
        variant === 'danger' &&
          'border-blood bg-blood text-bone hover:border-rust hover:bg-rust',
        className,
      )}
      {...rest}
    />
  );
}
