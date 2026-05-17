import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ScanStopStage = 'search' | 'analysis';

type Props = {
  stage: ScanStopStage;
  onStop: () => void;
  className?: string;
};

/** Header-aligned stop control (hints live in page subtitle / dashboard banner, not here). */
export function ScanStopControl({ stage, onStop, className }: Props) {
  const analysis = stage === 'analysis';

  return (
    <Button
      type="button"
      variant={analysis ? 'outline' : 'destructive'}
      className={cn(
        'gap-2 font-semibold shrink-0 h-10',
        analysis &&
          'border-amber-500/40 text-amber-100 hover:bg-amber-500/15 hover:text-amber-50',
        className,
      )}
      onClick={onStop}
      title={
        analysis
          ? 'Stop classifying and calculating sizes for found items'
          : 'Stop searching for new cleanup targets'
      }
    >
      {analysis ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Stop analysis
        </>
      ) : (
        <>
          <X className="size-4" aria-hidden />
          Stop scan
        </>
      )}
    </Button>
  );
}
