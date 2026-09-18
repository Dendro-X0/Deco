import { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/i18n';
import {
  configRedirectSteps,
  defaultConfigRedirectDest,
  type ConfigRedirectToolId,
} from '@/lib/config-redirect-wizards';

type Props = {
  toolId: ConfigRedirectToolId;
  disabled?: boolean;
};

function CopyButton({ text, disabled }: { text: string; disabled?: boolean }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 w-7 p-0 shrink-0"
      disabled={disabled || !text}
      title={t('settings.toolMigration.configWizard.copy')}
      onClick={() => void copy()}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

function StepList({
  steps,
  disabled,
  ordered,
}: {
  steps: ReturnType<typeof configRedirectSteps>['setup'];
  disabled?: boolean;
  ordered?: boolean;
}) {
  const ListTag = ordered ? 'ol' : 'ul';
  const listClass = ordered ? 'list-decimal pl-4 space-y-1' : 'space-y-1';

  return (
    <ListTag className={listClass}>
      {steps.map((step, index) => (
        <li key={`${index}-${step.command ?? step.text?.slice(0, 24) ?? 'step'}`} className="flex items-start gap-1">
          {step.command ? (
            <>
              {step.text ? <span className="flex-1 leading-relaxed">{step.text}</span> : null}
              <code className="flex-1 font-mono text-[11px] break-all">{step.command}</code>
              <CopyButton text={step.command} disabled={disabled} />
            </>
          ) : (
            <span className="flex-1 leading-relaxed">{step.text ?? ''}</span>
          )}
        </li>
      ))}
    </ListTag>
  );
}

export function ConfigRedirectWizard({ toolId, disabled }: Props) {
  const { t } = useI18n();
  const [dest, setDest] = useState(() => defaultConfigRedirectDest(toolId));

  const { setup, verify } = useMemo(() => configRedirectSteps(toolId, dest), [toolId, dest]);

  const toolLabel =
    toolId === 'npm-cache'
      ? t('settings.toolMigration.configWizard.npmTitle')
      : toolId === 'pnpm-store'
        ? t('settings.toolMigration.configWizard.pnpmTitle')
        : t('settings.toolMigration.configWizard.dockerTitle');

  const hint =
    toolId === 'docker-desktop'
      ? t('settings.toolMigration.configWizard.dockerHint')
      : t('settings.toolMigration.configWizard.hint');

  const showDestInput = true;

  return (
    <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 space-y-3 text-xs">
      <div>
        <p className="font-semibold text-sky-950 dark:text-sky-100">{toolLabel}</p>
        <p className="mt-1 text-muted-foreground leading-relaxed">{hint}</p>
      </div>
      {showDestInput ? (
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
            {toolId === 'docker-desktop'
              ? t('settings.toolMigration.configWizard.dockerDestLabel')
              : t('settings.toolMigration.configWizard.destLabel')}
          </label>
          <Input
            value={dest}
            onChange={(e) => setDest(e.target.value)}
            disabled={disabled}
            className="font-mono text-xs h-8"
            placeholder={defaultConfigRedirectDest(toolId)}
          />
        </div>
      ) : null}
      {setup.length > 0 ? (
        <div className="space-y-1">
          <p className="font-semibold">{t('settings.toolMigration.configWizard.setupTitle')}</p>
          <StepList steps={setup} disabled={disabled} ordered={toolId === 'docker-desktop'} />
        </div>
      ) : null}
      {verify.length > 0 ? (
        <div className="space-y-1">
          <p className="font-semibold">{t('settings.toolMigration.configWizard.verifyTitle')}</p>
          <StepList steps={verify} disabled={disabled} ordered={toolId === 'docker-desktop'} />
        </div>
      ) : null}
    </div>
  );
}
