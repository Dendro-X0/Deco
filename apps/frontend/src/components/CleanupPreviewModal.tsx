import { useState } from 'react';
import { AlertTriangle, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { formatBytes } from '@/lib/format';
import type { Candidate, ExecutePreviewResponse } from '@/types';

const REVIEW_PHRASE = 'DELETE REVIEW';

type Props = {
  open: boolean;
  onClose: () => void;
  selectedIds: Set<string>;
  candidates: Candidate[];
  preview: ExecutePreviewResponse | null;
  loading: boolean;
  onConfirm: (includeReview: boolean) => void;
};

export function CleanupPreviewModal({
  open,
  onClose,
  selectedIds,
  candidates,
  preview,
  loading,
  onConfirm,
}: Props) {
  const [includeReview, setIncludeReview] = useState(false);
  const [phrase, setPhrase] = useState('');

  const selectedReviewCount = candidates.filter(
    (c) => selectedIds.has(c.id) && c.risk === 'review',
  ).length;
  const hasReviewSelected = selectedReviewCount > 0;
  const phraseOk = !includeReview || phrase.trim() === REVIEW_PHRASE;
  const canConfirm =
    !loading &&
    preview &&
    preview.blocked_count === 0 &&
    phraseOk &&
    (!includeReview || hasReviewSelected);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className="relative w-full max-w-lg rounded-xl border bg-card shadow-2xl"
        role="dialog"
        aria-labelledby="preview-cleanup-title"
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h3 id="preview-cleanup-title" className="text-lg font-bold">
              Preview cleanup
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Files go to quarantine first — you can restore them anytime.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {loading && <p className="text-sm text-muted-foreground">Calculating preview…</p>}

          {preview && !loading && (
            <>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-primary/10 p-3">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Safe</p>
                  <p className="text-sm font-black text-primary">{preview.totals_by_risk.safe.count}</p>
                  <p className="text-[10px] text-muted-foreground">{formatBytes(preview.totals_by_risk.safe.bytes)}</p>
                </div>
                <div className="rounded-lg bg-amber-500/10 p-3">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Review</p>
                  <p className="text-sm font-black text-amber-600">{preview.totals_by_risk.review.count}</p>
                  <p className="text-[10px] text-muted-foreground">{formatBytes(preview.totals_by_risk.review.bytes)}</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Total</p>
                  <p className="text-sm font-black">{preview.selected_count}</p>
                  <p className="text-[10px] text-muted-foreground">{formatBytes(preview.selected_bytes)}</p>
                </div>
              </div>

              {preview.blocked_count > 0 && (
                <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
                  <AlertTriangle size={18} className="text-destructive shrink-0 mt-0.5" />
                  <p>
                    {preview.blocked_count} blocked item(s) in your selection cannot be removed. Deselect them to
                    continue.
                  </p>
                </div>
              )}

              {hasReviewSelected && (
                <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                  <div className="flex gap-2">
                    <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                    <div className="space-y-1 text-sm">
                      <p className="font-semibold">Review-tier items need extra confirmation</p>
                      <p className="text-xs text-muted-foreground">
                        These may include global caches or virtual environments. Only proceed if you understand what
                        will be quarantined.
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={includeReview} onCheckedChange={(v) => setIncludeReview(v === true)} />
                    Include {selectedReviewCount} review-tier item(s) in this cleanup
                  </label>
                  {includeReview && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">
                        Type <span className="font-mono font-bold">{REVIEW_PHRASE}</span> to confirm:
                      </p>
                      <Input
                        value={phrase}
                        onChange={(e) => setPhrase(e.target.value)}
                        placeholder={REVIEW_PHRASE}
                        className="font-mono text-sm"
                        autoComplete="off"
                      />
                    </div>
                  )}
                </div>
              )}

              {!hasReviewSelected && (
                <div className="flex gap-2 text-sm text-muted-foreground">
                  <ShieldCheck size={16} className="text-primary shrink-0" />
                  Only safe-tier items will be quarantined unless you opt in above.
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!canConfirm} onClick={() => onConfirm(includeReview && hasReviewSelected)}>
            Quarantine selected
          </Button>
        </div>
      </div>
    </div>
  );
}
