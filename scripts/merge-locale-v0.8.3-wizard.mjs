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
  wizard: {
    title: 'Free up space',
    subtitle: 'Guided cleanup — safe by default',
    steps: { intro: 'Welcome', scanning: 'Scan', results: 'Review', preview: 'Clean' },
    introBody:
      'Deco finds development clutter — old node_modules, build folders, and caches — and moves them to quarantine so you can undo later.',
    introList1: 'Scan dev folders and local drives for reclaimable clutter',
    introList2: 'Review what is safe vs needs caution',
    introList3: 'Preview and quarantine selected items',
    scanRoots: '{{count}} scan root{{suffix}} ({{scope}}). Adjust paths in Settings if needed.',
    configurePaths: 'Configure paths',
    startScan: 'Start scan',
    continueBackground: 'Continue in background',
    safeToClean: 'Safe to clean',
    folders: '{{count}} folders',
    needsReview: 'Needs review',
    preSelected: 'We pre-selected {{count}} safe items. Adjust the list on the dashboard before cleaning.',
    continuePreview: 'Continue to preview',
    doneMessage: 'Cleanup finished. Restored files live in Quarantine.',
    done: 'Done',
  },
  common: {
    deletePermanentTitle: 'Delete permanently?',
  },
};

const cn = {
  wizard: {
    title: '释放磁盘空间',
    subtitle: '引导式清理 — 默认安全',
    steps: { intro: '欢迎', scanning: '扫描', results: '审核', preview: '清理' },
    introBody:
      'Deco 查找开发 clutter — 旧的 node_modules、构建文件夹和缓存 — 并将其移至隔离区以便稍后撤销。',
    introList1: '扫描开发文件夹和本地驱动器以查找可回收 clutter',
    introList2: '审核哪些安全、哪些需要谨慎',
    introList3: '预览并隔离所选项目',
    scanRoots: '{{count}} 个扫描根路径{{suffix}}（{{scope}}）。如需调整，请前往设置。',
    configurePaths: '配置路径',
    startScan: '开始扫描',
    continueBackground: '在后台继续',
    safeToClean: '可安全清理',
    folders: '{{count}} 个文件夹',
    needsReview: '需要审核',
    preSelected: '我们已预选 {{count}} 个安全项目。清理前请在仪表盘上调整列表。',
    continuePreview: '继续预览',
    doneMessage: '清理完成。已恢复的文件位于隔离区。',
    done: '完成',
  },
  common: { deletePermanentTitle: '永久删除？' },
};

const es = {
  wizard: {
    title: 'Liberar espacio',
    subtitle: 'Limpieza guiada — segura por defecto',
    steps: { intro: 'Bienvenida', scanning: 'Escanear', results: 'Revisar', preview: 'Limpiar' },
    introBody:
      'Deco encuentra clutter de desarrollo — node_modules antiguos, carpetas de compilación y cachés — y los mueve a cuarentena para poder deshacer después.',
    introList1: 'Escanee carpetas de desarrollo y unidades locales en busca de clutter recuperable',
    introList2: 'Revise qué es seguro y qué requiere precaución',
    introList3: 'Previsualice y ponga en cuarentena los elementos seleccionados',
    scanRoots:
      '{{count}} raíz de escaneo{{suffix}} ({{scope}}). Ajuste rutas en Configuración si es necesario.',
    configurePaths: 'Configurar rutas',
    startScan: 'Iniciar escaneo',
    continueBackground: 'Continuar en segundo plano',
    safeToClean: 'Seguro para limpiar',
    folders: '{{count}} carpetas',
    needsReview: 'Requiere revisión',
    preSelected:
      'Preseleccionamos {{count}} elementos seguros. Ajuste la lista en el panel antes de limpiar.',
    continuePreview: 'Continuar a la vista previa',
    doneMessage: 'Limpieza terminada. Los archivos restaurados están en Cuarentena.',
    done: 'Hecho',
  },
  common: { deletePermanentTitle: '¿Eliminar permanentemente?' },
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

console.log('Merged wizard locale keys');
