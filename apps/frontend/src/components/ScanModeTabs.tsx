import { FolderTree, HardDrive } from 'lucide-react';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useI18n } from '@/i18n';

type Props = {
  disabled?: boolean;
};

/** Tab triggers for scan mode; must be used inside a parent `<Tabs value={mode}>`. */
export function ScanModeTabList({ disabled }: Props) {
  const { t } = useI18n();

  return (
    <TabsList className="grid w-full grid-cols-2 h-10 bg-muted/50">
      <TabsTrigger
        value="partition"
        disabled={disabled}
        className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:text-primary"
      >
        <HardDrive size={14} className="shrink-0" />
        {t('dashboard.scanMode.partition')}
      </TabsTrigger>
      <TabsTrigger
        value="custom"
        disabled={disabled}
        className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:text-primary"
      >
        <FolderTree size={14} className="shrink-0" />
        {t('dashboard.scanMode.custom')}
      </TabsTrigger>
    </TabsList>
  );
}
