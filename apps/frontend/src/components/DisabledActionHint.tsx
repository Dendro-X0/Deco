import { cloneElement, isValidElement, type ReactElement } from 'react';
import { cn } from '@/lib/utils';

type DisabledChildProps = {
  disabled?: boolean;
  className?: string;
};

type Props = {
  /** When set, the control is disabled and this text is shown on hover. */
  reason: string | null | undefined;
  children: ReactElement<DisabledChildProps>;
};

/**
 * Wraps a button (or similar) so tooltips work while disabled:
 * native `title` on disabled controls does not show in most browsers.
 */
export function DisabledActionHint({ reason, children }: Props) {
  if (!reason) {
    return children;
  }

  if (!isValidElement(children)) {
    return children;
  }

  return (
    <span
      className="inline-flex cursor-not-allowed"
      title={reason}
      aria-label={reason}
    >
      {cloneElement(children, {
        disabled: true,
        className: cn(children.props.className, 'pointer-events-none'),
      })}
    </span>
  );
}
