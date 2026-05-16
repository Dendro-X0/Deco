import { ShieldAlert, Search, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DecoLogo } from '@/components/DecoLogo';

type Props = {
  open: boolean;
  onGetStarted: () => void;
  onDismiss: () => void;
};

const STEPS = [
  {
    icon: Search,
    title: 'Scan your workspace',
    body: 'Pick partitions or custom folders, then run a scan. Deco classifies caches and build artifacts by risk.',
  },
  {
    icon: ShieldAlert,
    title: 'Review before you clean',
    body: 'Safe items are selected by default. Review-tier paths need your explicit OK — nothing is shredded blindly.',
  },
  {
    icon: Sparkles,
    title: 'Quarantine first',
    body: 'Cleanup moves files to quarantine so you can restore or purge later. Use the planner to hit a free-space target.',
  },
] as const;

export function OnboardingDialog({ open, onGetStarted, onDismiss }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/85 backdrop-blur-md" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="relative z-10 w-full max-w-lg rounded-xl border border-border/60 bg-card p-6 shadow-2xl"
      >
        <button
          type="button"
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:text-foreground"
          onClick={onDismiss}
          aria-label="Close"
        >
          <X size={16} />
        </button>
        <DecoLogo size="sm" className="mb-4" />
        <h2 id="onboarding-title" className="text-xl font-bold tracking-tight">
          Welcome to Deco
        </h2>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          Developer Compact helps you reclaim disk space from project caches and build output — safely.
        </p>
        <ul className="mt-5 space-y-3">
          {STEPS.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="flex gap-3 rounded-lg border border-border/40 bg-muted/15 p-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Icon size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            Skip for now
          </Button>
          <Button size="sm" className="gap-2 font-semibold" onClick={onGetStarted}>
            <Sparkles size={14} /> Get started
          </Button>
        </div>
      </div>
    </div>
  );
}
