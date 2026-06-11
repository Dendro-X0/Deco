import { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/i18n';
import {
  configRedirectCommands,
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

export function ConfigRedirectWizard({ toolId, disabled }: Props) {
  const { t } = useI18n();
  const [dest, setDest] = useState(() => defaultConfigRedirectDest(toolId));

  const { setup, verify } = useMemo(
    () => configRedirectCommands(toolId, dest),
    [toolId, dest],
  );

  const toolLabel =
    toolId === 'npm-cache'
      ? t('settings.toolMigration.configWizard.npmTitle')
      : t('settings.toolMigration.configWizard.pnpmTitle');

  return (
    <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 space-y-3 text-xs">
      <div>
        <p className="font-semibold text-sky-950 dark:text-sky-100">{toolLabel}</p>
        <p className="mt-1 text-muted-foreground leading-relaxed">
          {t('settings.toolMigration.configWizard.hint')}
        </p>
      </div>
      <div className="space-y-1.5">
        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
          {t('settings.toolMigration.configWizard.destLabel')}
        </label>
        <Input
          value={dest}
          onChange={(e) => setDest(e.target.value)}
          disabled={disabled}
          className="font-mono text-xs h-8"
          placeholder={defaultConfigRedirectDest(toolId)}
        />
      </div>
      {setup.length > 0 ? (
        <div className="space-y-1">
          <p className="font-semibold">{t('settings.toolMigration.configWizard.setupTitle')}</p>
          <ol className="list-decimal pl-4 space-y-1">
            {setup.map((cmd) => (
              <li key={cmd} className="flex items-start gap-1">
                <code className="flex-1 font-mono text-[11px] break-all">{cmd}</code>
                <CopyButton text={cmd} disabled={disabled} />
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {verify.length > 0 ? (
        <div className="space-y-1">
          <p className="font-semibold">{t('settings.toolMigration.configWizard.verifyTitle')}</p>
          <ul className="space-y-1">
            {verify.map((cmd) => (
              <li key={cmd} className="flex items-start gap-1">
                <code className="flex-1 font-mono text-[11px] break-all">{cmd}</code>
                <CopyButton text={cmd} disabled={disabled} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
