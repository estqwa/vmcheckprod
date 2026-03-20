import * as React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type FormFieldProps = React.ComponentProps<'div'> & {
  label?: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
};

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  className,
  children,
  ...props
}: FormFieldProps) {
  return (
    <div className={cn('space-y-2', className)} {...props}>
      {label ? (
        <Label htmlFor={htmlFor} className="text-sm font-semibold text-foreground">
          {label}
          {required ? <span className="ml-1 text-destructive">*</span> : null}
        </Label>
      ) : null}
      {children}
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
