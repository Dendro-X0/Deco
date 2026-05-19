#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../apps/frontend/src/i18n/messages');

function deepAssign(target, source) {
  for (const k of Object.keys(source)) {
    if (
      source[k] &&
      typeof source[k] === 'object' &&
      !Array.isArray(source[k]) &&
      typeof target[k] === 'object'
    ) {
      deepAssign(target[k], source[k]);
    } else {
      target[k] = source[k];
    }
  }
}

const en = {
  common: {
    deletePermanentConfirm: 'Delete permanently',
  },
  directDelete: {
    noSafeSelected:
      'No safe-tier items are selected. Permanent delete only applies to safe-tier folders. Use “Move to quarantine…” for review-tier items, or change your selection.',
    confirmIntro: 'Permanently delete {{count}} folder(s) ({{size}})?',
    confirmWarning:
      'Files are removed from disk immediately — not moved to quarantine — and cannot be restored from Deco.',
    reviewSkipped: '{{count}} review-tier item(s) in your selection will be skipped.',
    blockedSkipped: '{{count}} blocked item(s) cannot be deleted.',
  },
  cleanupResult: {
    complete: 'Cleanup complete',
    nothingSelected: 'Nothing selected',
    nothingSelectedHint: 'Select candidates in the results table, then use Clean selected.',
    notQuarantined: 'No items quarantined',
    reviewSkippedHint:
      '{{count}} review-tier item(s) were skipped. In the preview dialog, check “Include review-tier items” and type DELETE REVIEW to confirm.',
    optInSkippedHint:
      '{{count}} global-cache item(s) need matching toggles under Settings → Discovery, then re-scan.',
    blockedSkippedHint:
      '{{count}} blocked item(s) cannot be removed. Deselect them and try again.',
    failed: 'Cleanup failed',
    missingPaths: '{{count}} path(s) no longer exist on disk.',
    nothingMoved: 'Nothing was moved. Re-run the scan if paths changed.',
    deletedOnly: '{{count}} deleted (freed space immediately)',
    quarantinedOnly: '{{count}} moved to quarantine',
    mixed: '{{quarantined}} quarantined, {{deleted}} deleted in place',
    skippedReview: '{{count}} review-tier skipped (enable in preview)',
    skippedMissing: '{{count}} already missing',
    skippedOptIn: '{{count}} need opt-in in Settings',
    errorsInStatus: '{{count}} error(s) — see status bar',
    took: ' Took {{duration}}.',
  },
  dashboard: {
    cleanupStats: {
      title: 'Cleanup results',
      copyDiagnostics: 'Copy diagnostics',
      copied: 'Copied',
      spaceFreed: 'Space freed',
      foldersRemoved: 'Folders removed',
      deletedInPlace: 'Deleted in place',
      quarantined: 'Quarantined',
      restoreHint: 'Restore from Quarantine tab',
      skippedIssues: 'Skipped / issues',
      reviewSkipped: '{{count}} review-tier (not included)',
      missingSkipped: '{{count}} already missing on disk',
      optInSkipped: '{{count}} need opt-in in Settings',
      blockedSkipped: '{{count}} blocked by policy',
      removedByKind: 'Removed by kind',
      headlineFreed: 'Freed {{size}} · {{count}} folder(s){{time}}',
      headlineProcessed: '{{count}} folder(s) processed{{time}}',
      headlineFinished: 'Cleanup finished{{time}}',
    },
    sizeFilter: {
      presetsAria: 'Size presets',
      minPlaceholder: 'Min (e.g. 100MB)',
      maxPlaceholder: 'Max (optional)',
    },
  },
  statusFooter: {
    elapsedTime: 'Elapsed time',
    decoVersion: 'Deco version',
  },
};

const cn = {
  common: { deletePermanentConfirm: '永久删除' },
  directDelete: {
    noSafeSelected:
      '未选择安全级项目。永久删除仅适用于安全级文件夹。请对审核级项目使用“移至隔离区…”，或更改选择。',
    confirmIntro: '永久删除 {{count}} 个文件夹（{{size}}）？',
    confirmWarning: '文件将立即从磁盘删除 — 不会移至隔离区 — 且无法从 Deco 恢复。',
    reviewSkipped: '选择中的 {{count}} 个审核级项目将被跳过。',
    blockedSkipped: '{{count}} 个被阻止的项目无法删除。',
  },
  cleanupResult: {
    complete: '清理完成',
    nothingSelected: '未选择任何项目',
    nothingSelectedHint: '在结果表中选择候选项目，然后使用“清理所选”。',
    notQuarantined: '无项目被隔离',
    reviewSkippedHint:
      '跳过了 {{count}} 个审核级项目。在预览对话框中勾选“包含审核级项目”并输入 DELETE REVIEW 确认。',
    optInSkippedHint: '{{count}} 个全局缓存项目需要在设置 → 发现中启用相应选项，然后重新扫描。',
    blockedSkippedHint: '{{count}} 个被阻止的项目无法删除。请取消选择后重试。',
    failed: '清理失败',
    missingPaths: '{{count}} 个路径在磁盘上已不存在。',
    nothingMoved: '未移动任何内容。如果路径已更改，请重新扫描。',
    deletedOnly: '已删除 {{count}} 个（立即释放空间）',
    quarantinedOnly: '{{count}} 个已移至隔离区',
    mixed: '{{quarantined}} 个已隔离，{{deleted}} 个已就地删除',
    skippedReview: '跳过 {{count}} 个审核级（在预览中启用）',
    skippedMissing: '{{count}} 个已不存在',
    skippedOptIn: '{{count}} 个需要在设置中启用',
    errorsInStatus: '{{count}} 个错误 — 见状态栏',
    took: ' 耗时 {{duration}}。',
  },
  dashboard: {
    cleanupStats: {
      title: '清理结果',
      copyDiagnostics: '复制诊断信息',
      copied: '已复制',
      spaceFreed: '释放空间',
      foldersRemoved: '已移除文件夹',
      deletedInPlace: '就地删除',
      quarantined: '已隔离',
      restoreHint: '从隔离区标签页恢复',
      skippedIssues: '跳过 / 问题',
      reviewSkipped: '{{count}} 个审核级（未包含）',
      missingSkipped: '{{count}} 个在磁盘上已不存在',
      optInSkipped: '{{count}} 个需要在设置中启用',
      blockedSkipped: '{{count}} 个被策略阻止',
      removedByKind: '按类型移除',
      headlineFreed: '释放 {{size}} · {{count}} 个文件夹{{time}}',
      headlineProcessed: '已处理 {{count}} 个文件夹{{time}}',
      headlineFinished: '清理完成{{time}}',
    },
    sizeFilter: {
      presetsAria: '大小预设',
      minPlaceholder: '最小（如 100MB）',
      maxPlaceholder: '最大（可选）',
    },
  },
  statusFooter: { elapsedTime: '已用时间', decoVersion: 'Deco 版本' },
};

const es = {
  common: { deletePermanentConfirm: 'Eliminar permanentemente' },
  directDelete: {
    noSafeSelected:
      'No hay elementos de nivel seguro seleccionados. La eliminación permanente solo aplica a carpetas seguras. Use “Mover a cuarentena…” para elementos de revisión o cambie la selección.',
    confirmIntro: '¿Eliminar permanentemente {{count}} carpeta(s) ({{size}})?',
    confirmWarning:
      'Los archivos se eliminan del disco de inmediato — no se mueven a cuarentena — y no se pueden restaurar desde Deco.',
    reviewSkipped: 'Se omitirán {{count}} elemento(s) de revisión en su selección.',
    blockedSkipped: '{{count}} elemento(s) bloqueados no se pueden eliminar.',
  },
  cleanupResult: {
    complete: 'Limpieza completa',
    nothingSelected: 'Nada seleccionado',
    nothingSelectedHint: 'Seleccione candidatos en la tabla de resultados y use Limpiar selección.',
    notQuarantined: 'No se pusieron elementos en cuarentena',
    reviewSkippedHint:
      'Se omitieron {{count}} elemento(s) de revisión. En el diálogo de vista previa, marque “Incluir elementos de revisión” y escriba DELETE REVIEW para confirmar.',
    optInSkippedHint:
      '{{count}} elemento(s) de caché global necesitan opciones en Configuración → Descubrimiento; vuelva a escanear.',
    blockedSkippedHint:
      '{{count}} elemento(s) bloqueados no se pueden eliminar. Deselecciónelos e intente de nuevo.',
    failed: 'Limpieza fallida',
    missingPaths: '{{count}} ruta(s) ya no existen en el disco.',
    nothingMoved: 'No se movió nada. Vuelva a escanear si las rutas cambiaron.',
    deletedOnly: '{{count}} eliminados (espacio liberado de inmediato)',
    quarantinedOnly: '{{count}} movidos a cuarentena',
    mixed: '{{quarantined}} en cuarentena, {{deleted}} eliminados in situ',
    skippedReview: '{{count}} de revisión omitidos (habilitar en vista previa)',
    skippedMissing: '{{count}} ya no existen',
    skippedOptIn: '{{count}} requieren opt-in en Configuración',
    errorsInStatus: '{{count}} error(es) — ver barra de estado',
    took: ' Tardó {{duration}}.',
  },
  dashboard: {
    cleanupStats: {
      title: 'Resultados de limpieza',
      copyDiagnostics: 'Copiar diagnóstico',
      copied: 'Copiado',
      spaceFreed: 'Espacio liberado',
      foldersRemoved: 'Carpetas eliminadas',
      deletedInPlace: 'Eliminado in situ',
      quarantined: 'En cuarentena',
      restoreHint: 'Restaurar desde la pestaña Cuarentena',
      skippedIssues: 'Omitidos / problemas',
      reviewSkipped: '{{count}} de revisión (no incluidos)',
      missingSkipped: '{{count}} ya no existen en el disco',
      optInSkipped: '{{count}} requieren opt-in en Configuración',
      blockedSkipped: '{{count}} bloqueados por política',
      removedByKind: 'Eliminados por tipo',
      headlineFreed: 'Liberados {{size}} · {{count}} carpeta(s){{time}}',
      headlineProcessed: '{{count}} carpeta(s) procesadas{{time}}',
      headlineFinished: 'Limpieza terminada{{time}}',
    },
    sizeFilter: {
      presetsAria: 'Presets de tamaño',
      minPlaceholder: 'Mín. (p. ej. 100MB)',
      maxPlaceholder: 'Máx. (opcional)',
    },
  },
  statusFooter: { elapsedTime: 'Tiempo transcurrido', decoVersion: 'Versión de Deco' },
};

for (const [code, patch] of [
  ['en', en],
  ['cn', cn],
  ['es', es],
]) {
  const path = join(dir, `${code}.json`);
  const data = JSON.parse(readFileSync(path, 'utf8'));
  deepAssign(data, patch);
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

console.log('Merged v0.8.3 phase-3 locale keys');
