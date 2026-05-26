import { type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';

const GUIDE_URL =
  'https://github.com/Dendro-X0/Deco/blob/main/docs/desktop/ide-storage-off-os-drive.md';

type SectionProps = {
  title: string;
  description?: string;
  children?: ReactNode;
};

function GuideSection({ title, description, children }: SectionProps) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-bold tracking-tight">{title}</h3>
        {description ? (
          <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">{description}</p>
        ) : null}
      </div>
      {children ?? null}
    </section>
  );
}

export function IdeStorageGuideSection() {
  const { t } = useI18n();

  const openGuide = () => {
    void invoke('open_url', { url: GUIDE_URL });
  };

  return (
    <GuideSection
      title={t('settings.ideStorageGuide.title')}
      description={t('settings.ideStorageGuide.description')}
    >
      <div className="space-y-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 max-w-2xl">
        <p className="text-xs font-medium text-amber-600/95 leading-relaxed">
          {t('settings.ideStorageGuide.disclaimer')}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">{t('settings.ideStorageGuide.intro')}</p>

        <div className="space-y-2">
          <p className="text-xs font-semibold">{t('settings.ideStorageGuide.decoRoleTitle')}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{t('settings.ideStorageGuide.decoRole')}</p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold">{t('settings.ideStorageGuide.easierToolsTitle')}</p>
          <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
            <li>{t('settings.ideStorageGuide.easierToolsNpm')}</li>
            <li>{t('settings.ideStorageGuide.easierToolsDocker')}</li>
            <li>{t('settings.ideStorageGuide.easierToolsRustGo')}</li>
          </ul>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold">{t('settings.ideStorageGuide.idePathsTitle')}</p>
          <div className="overflow-x-auto rounded border border-border/40 bg-background/40">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40 text-left">
                  <th className="p-2 font-semibold">{t('settings.ideStorageGuide.colTool')}</th>
                  <th className="p-2 font-semibold">{t('settings.ideStorageGuide.colRoaming')}</th>
                  <th className="p-2 font-semibold">{t('settings.ideStorageGuide.colLocal')}</th>
                </tr>
              </thead>
              <tbody className="font-mono text-[11px]">
                <tr className="border-b border-border/20">
                  <td className="p-2 align-top font-sans font-medium">Cursor</td>
                  <td className="p-2 break-all">%APPDATA%\Cursor</td>
                  <td className="p-2 break-all">%LOCALAPPDATA%\Cursor</td>
                </tr>
                <tr>
                  <td className="p-2 align-top font-sans font-medium">VS Code</td>
                  <td className="p-2 break-all">%APPDATA%\Code</td>
                  <td className="p-2 break-all">%LOCALAPPDATA%\…</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">{t('settings.ideStorageGuide.chatWarning')}</p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold">{t('settings.ideStorageGuide.manualTitle')}</p>
          <ol className="text-xs text-muted-foreground list-decimal pl-4 space-y-1 leading-relaxed">
            <li>{t('settings.ideStorageGuide.manualStep1')}</li>
            <li>{t('settings.ideStorageGuide.manualStep2')}</li>
            <li>{t('settings.ideStorageGuide.manualStep3')}</li>
            <li>{t('settings.ideStorageGuide.manualStep4')}</li>
            <li>{t('settings.ideStorageGuide.manualStep5')}</li>
            <li>{t('settings.ideStorageGuide.manualStep6')}</li>
          </ol>
          <p className="text-xs text-muted-foreground">{t('settings.ideStorageGuide.manualNtsf')}</p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold">{t('settings.ideStorageGuide.saferTitle')}</p>
          <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
            <li>{t('settings.ideStorageGuide.saferTemp')}</li>
            <li>{t('settings.ideStorageGuide.saferCache')}</li>
            <li>{t('settings.ideStorageGuide.saferScan')}</li>
          </ul>
        </div>

        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={openGuide}>
          <ExternalLink className="h-3.5 w-3.5" />
          {t('settings.ideStorageGuide.readFullGuide')}
        </Button>
      </div>
    </GuideSection>
  );
}
