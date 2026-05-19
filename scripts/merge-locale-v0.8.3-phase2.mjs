#!/usr/bin/env node
/** Phase-2 v0.8.3 keys: custom roots, modal, scan stats, workspace, scan mode, status runtime */
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
    cancel: 'Cancel',
    clearAll: 'Clear all',
    remove: 'Remove',
    close: 'Close',
    opening: 'Opening…',
    copied: 'Copied',
    copy: 'Copy',
    errorPrefix: 'Error: {{msg}}',
  },
  modal: {
    scanTargets: {
      title: 'Choose scan targets',
      subtitle: 'Pick a scanning mode, then configure partitions or custom folders.',
      regionAria: 'Scan target options',
      startScan: 'Start scan',
    },
  },
  dashboard: {
    customRoots: {
      title: 'Custom folders',
      description: 'Add one or more project directories with Browse. Only these paths are scanned.',
      browse: 'Browse folders…',
      clearAll: 'Clear all',
      empty: 'No folders yet — click Browse to add paths from File Explorer.',
      showInExplorer: 'Show in File Explorer',
      foldersReady: '{{count}} folder ready to scan',
      foldersReadyPlural: '{{count}} folders ready to scan',
    },
    scanModeSelector: {
      label: 'Scanning mode',
      partitionTitle: 'Partition-based scan',
      partitionDescription:
        'Scan selected drives (volume root + optional dev folders). Best on SSD; slower on HDD.',
      customTitle: 'Custom directories',
      customDescription:
        'Scan only folders you pick — ideal when you know where projects live (e.g. legacy HDD trees).',
    },
    scanStats: {
      title: 'Scan statistics',
      phasesUnavailable: 'Phase timings unavailable for this run.',
      wallSuffix: ' · {{duration}} wall',
      copyDiagnostics: 'Copy diagnostics',
      copied: 'Copied',
      quickUpdateReuse: 'Quick update reuse',
      quickUpdateReuseDetail:
        '{{reused}} of {{total}} candidates ({{percent}}%) reused from inventory',
      timeByPhase: 'Time by phase',
      topKindsBySize: 'Top kinds by size',
      phases: {
        discover: 'Discover',
        classify: 'Classify',
        size: 'Size',
      },
      phaseTimingLine: 'Discover {{discover}} · Classify {{classify}} · Size {{size}}',
    },
    workspace: {
      title: 'Workspace summary',
      description:
        '{{count}} project{{suffix}} · {{reclaimable}} reclaimable (safe + review) — each folder counted once',
      showLess: 'Show less',
      showAll: 'All {{count}}',
      projectSuffix: 's',
    },
  },
  onboarding: {
    welcome: 'Welcome to Deco',
    subtitle:
      'Developer Compact helps you reclaim disk space from project caches and build output — safely.',
    skip: 'Skip for now',
    getStarted: 'Get started',
    closeAria: 'Close',
    steps: {
      scan: {
        title: 'Scan your workspace',
        body: 'Pick partitions or custom folders, then run a scan. Deco classifies caches and build artifacts by risk.',
      },
      review: {
        title: 'Review before you clean',
        body: 'Safe items are selected by default. Review-tier paths need your explicit OK — nothing is shredded blindly.',
      },
      quarantine: {
        title: 'Quarantine first',
        body: 'Cleanup moves files to quarantine so you can restore or purge later. Use the planner to hit a free-space target.',
      },
    },
  },
  status: {
    stoppingCleanup: 'Stopping cleanup…',
    searchStoppedClassifying: 'Search stopped — classifying and sizing found items…',
    stoppingAnalysis: 'Stopping analysis…',
    scanStopped: 'Scan stopped',
    noCustomFolders: 'No custom folders configured',
    invalidCustomPaths: 'Invalid custom paths',
    noPartitionSelected: 'No partition selected',
    startingScan: 'Starting scan…',
    scanRunning: 'Scan running in background',
    cleanupFailed: 'Cleanup failed',
    deleting: 'Deleting…',
    cleanupInProgress: 'Cleanup in progress…',
    scanningDirs: 'Scanning… {{dirs}} dirs',
    scanningDirsDetail: 'Scanning directories… {{scanned}} scanned, {{found}} found',
    scanComplete: 'Scan complete',
    scanCompleteTiming: 'Scan complete · discover {{discover}}, classify {{classify}}, size {{size}}',
    scanCompleteSummary:
      'Scan complete: {{count}} items{{sizeHint}}{{unsizedHint}}{{timeHint}}.',
    scanCanceledSummary:
      'Scan canceled: {{count}} partial items{{sizeHint}}{{unsizedHint}}{{timeHint}}.',
    measuredSuffix: ' · {{size}} measured',
    unsizedSuffix: ' · {{count}} not calculated',
    scanningFallback: 'Scanning…',
    phase: {
      discover: 'Discover',
      classify: 'Classify',
      size: 'Size',
      done: 'Done',
      cleanup: 'Cleanup',
    },
  },
};

const cn = {
  common: {
    cancel: '取消',
    clearAll: '全部清除',
    remove: '移除',
    close: '关闭',
    opening: '正在打开…',
    copied: '已复制',
    copy: '复制',
    errorPrefix: '错误：{{msg}}',
  },
  modal: {
    scanTargets: {
      title: '选择扫描目标',
      subtitle: '选择扫描模式，然后配置分区或自定义文件夹。',
      regionAria: '扫描目标选项',
      startScan: '开始扫描',
    },
  },
  dashboard: {
    customRoots: {
      title: '自定义文件夹',
      description: '通过浏览添加一个或多个项目目录。仅扫描这些路径。',
      browse: '浏览文件夹…',
      clearAll: '全部清除',
      empty: '尚无文件夹 — 点击浏览从文件资源管理器添加路径。',
      showInExplorer: '在文件资源管理器中显示',
      foldersReady: '{{count}} 个文件夹已就绪',
      foldersReadyPlural: '{{count}} 个文件夹已就绪',
    },
    scanModeSelector: {
      label: '扫描模式',
      partitionTitle: '基于分区的扫描',
      partitionDescription: '扫描所选驱动器（卷根目录 + 可选开发文件夹）。SSD 上效果最佳；HDD 较慢。',
      customTitle: '自定义目录',
      customDescription: '仅扫描您选择的文件夹 — 适合已知项目位置（如旧 HDD 目录树）。',
    },
    scanStats: {
      title: '扫描统计',
      phasesUnavailable: '此运行无阶段计时数据。',
      wallSuffix: ' · 总耗时 {{duration}}',
      copyDiagnostics: '复制诊断信息',
      copied: '已复制',
      quickUpdateReuse: '快速更新复用',
      quickUpdateReuseDetail: '{{reused}} / {{total}} 个候选（{{percent}}%）来自清单复用',
      timeByPhase: '各阶段耗时',
      topKindsBySize: '按大小排序的类型',
      phases: { discover: '发现', classify: '分类', size: '测量' },
      phaseTimingLine: '发现 {{discover}} · 分类 {{classify}} · 测量 {{size}}',
    },
    workspace: {
      title: '工作区摘要',
      description: '{{count}} 个项目{{suffix}} · 可回收 {{reclaimable}}（安全 + 审核）— 每个文件夹仅计一次',
      showLess: '收起',
      showAll: '全部 {{count}}',
      projectSuffix: '',
    },
  },
  onboarding: {
    welcome: '欢迎使用 Deco',
    subtitle: 'Developer Compact 帮助您安全地从项目缓存和构建输出中回收磁盘空间。',
    skip: '暂时跳过',
    getStarted: '开始使用',
    closeAria: '关闭',
    steps: {
      scan: {
        title: '扫描工作区',
        body: '选择分区或自定义文件夹，然后运行扫描。Deco 按风险对缓存和构建产物进行分类。',
      },
      review: {
        title: '清理前先审核',
        body: '默认选中安全项。审核级路径需要您明确确认 — 不会盲目删除。',
      },
      quarantine: {
        title: '先隔离',
        body: '清理将文件移至隔离区，可随时恢复或清除。使用规划器达到目标可用空间。',
      },
    },
  },
  status: {
    stoppingCleanup: '正在停止清理…',
    searchStoppedClassifying: '搜索已停止 — 正在分类和测量已找到的项目…',
    stoppingAnalysis: '正在停止分析…',
    scanStopped: '扫描已停止',
    noCustomFolders: '未配置自定义文件夹',
    invalidCustomPaths: '自定义路径无效',
    noPartitionSelected: '未选择分区',
    startingScan: '正在启动扫描…',
    scanRunning: '扫描在后台运行',
    cleanupFailed: '清理失败',
    deleting: '正在删除…',
    cleanupInProgress: '清理进行中…',
    scanningDirs: '正在扫描… {{dirs}} 个目录',
    scanningDirsDetail: '正在扫描目录… 已扫描 {{scanned}}，找到 {{found}}',
    scanComplete: '扫描完成',
    scanCompleteTiming: '扫描完成 · 发现 {{discover}}，分类 {{classify}}，测量 {{size}}',
    scanCompleteSummary: '扫描完成：{{count}} 个项目{{sizeHint}}{{unsizedHint}}{{timeHint}}。',
    scanCanceledSummary: '扫描已取消：{{count}} 个部分项目{{sizeHint}}{{unsizedHint}}{{timeHint}}。',
    measuredSuffix: ' · 已测量 {{size}}',
    unsizedSuffix: ' · {{count}} 个未计算',
    scanningFallback: '正在扫描…',
    phase: { discover: '发现', classify: '分类', size: '测量', done: '完成', cleanup: '清理' },
  },
};

const es = {
  common: {
    cancel: 'Cancelar',
    clearAll: 'Borrar todo',
    remove: 'Quitar',
    close: 'Cerrar',
    opening: 'Abriendo…',
    copied: 'Copiado',
    copy: 'Copiar',
    errorPrefix: 'Error: {{msg}}',
  },
  modal: {
    scanTargets: {
      title: 'Elegir objetivos de escaneo',
      subtitle: 'Elija un modo de escaneo y configure particiones o carpetas personalizadas.',
      regionAria: 'Opciones de objetivo de escaneo',
      startScan: 'Iniciar escaneo',
    },
  },
  dashboard: {
    customRoots: {
      title: 'Carpetas personalizadas',
      description: 'Añada uno o más directorios de proyecto con Examinar. Solo se escanean estas rutas.',
      browse: 'Examinar carpetas…',
      clearAll: 'Borrar todo',
      empty: 'Aún no hay carpetas — haga clic en Examinar para añadir rutas desde el Explorador.',
      showInExplorer: 'Mostrar en el Explorador',
      foldersReady: '{{count}} carpeta lista para escanear',
      foldersReadyPlural: '{{count}} carpetas listas para escanear',
    },
    scanModeSelector: {
      label: 'Modo de escaneo',
      partitionTitle: 'Escaneo por partición',
      partitionDescription:
        'Escanee unidades seleccionadas (raíz del volumen + carpetas de desarrollo opcionales). Mejor en SSD; más lento en HDD.',
      customTitle: 'Directorios personalizados',
      customDescription:
        'Escanee solo las carpetas que elija — ideal cuando conoce dónde están los proyectos (p. ej. árboles HDD antiguos).',
    },
    scanStats: {
      title: 'Estadísticas del escaneo',
      phasesUnavailable: 'Tiempos por fase no disponibles para esta ejecución.',
      wallSuffix: ' · {{duration}} total',
      copyDiagnostics: 'Copiar diagnóstico',
      copied: 'Copiado',
      quickUpdateReuse: 'Reutilización de actualización rápida',
      quickUpdateReuseDetail:
        '{{reused}} de {{total}} candidatos ({{percent}}%) reutilizados del inventario',
      timeByPhase: 'Tiempo por fase',
      topKindsBySize: 'Tipos principales por tamaño',
      phases: { discover: 'Descubrir', classify: 'Clasificar', size: 'Medir' },
      phaseTimingLine: 'Descubrir {{discover}} · Clasificar {{classify}} · Medir {{size}}',
    },
    workspace: {
      title: 'Resumen del espacio de trabajo',
      description:
        '{{count}} proyecto{{suffix}} · {{reclaimable}} recuperables (seguro + revisión) — cada carpeta cuenta una vez',
      showLess: 'Mostrar menos',
      showAll: 'Todos ({{count}})',
      projectSuffix: 's',
    },
  },
  onboarding: {
    welcome: 'Bienvenido a Deco',
    subtitle:
      'Developer Compact le ayuda a recuperar espacio en disco de cachés y artefactos de compilación — con seguridad.',
    skip: 'Omitir por ahora',
    getStarted: 'Empezar',
    closeAria: 'Cerrar',
    steps: {
      scan: {
        title: 'Escanee su espacio de trabajo',
        body: 'Elija particiones o carpetas personalizadas y ejecute un escaneo. Deco clasifica cachés y artefactos por riesgo.',
      },
      review: {
        title: 'Revise antes de limpiar',
        body: 'Los elementos seguros se seleccionan por defecto. Las rutas de revisión requieren su confirmación explícita.',
      },
      quarantine: {
        title: 'Cuarentena primero',
        body: 'La limpieza mueve archivos a cuarentena para restaurar o purgar después. Use el planificador para un objetivo de espacio libre.',
      },
    },
  },
  status: {
    stoppingCleanup: 'Deteniendo limpieza…',
    searchStoppedClassifying: 'Búsqueda detenida — clasificando y midiendo elementos encontrados…',
    stoppingAnalysis: 'Deteniendo análisis…',
    scanStopped: 'Escaneo detenido',
    noCustomFolders: 'No hay carpetas personalizadas configuradas',
    invalidCustomPaths: 'Rutas personalizadas no válidas',
    noPartitionSelected: 'Ninguna partición seleccionada',
    startingScan: 'Iniciando escaneo…',
    scanRunning: 'Escaneo en segundo plano',
    cleanupFailed: 'Limpieza fallida',
    deleting: 'Eliminando…',
    cleanupInProgress: 'Limpieza en curso…',
    scanningDirs: 'Escaneando… {{dirs}} dirs',
    scanningDirsDetail: 'Escaneando directorios… {{scanned}} escaneados, {{found}} encontrados',
    scanComplete: 'Escaneo completo',
    scanCompleteTiming:
      'Escaneo completo · descubrir {{discover}}, clasificar {{classify}}, medir {{size}}',
    scanCompleteSummary:
      'Escaneo completo: {{count}} elementos{{sizeHint}}{{unsizedHint}}{{timeHint}}.',
    scanCanceledSummary:
      'Escaneo cancelado: {{count}} elementos parciales{{sizeHint}}{{unsizedHint}}{{timeHint}}.',
    measuredSuffix: ' · {{size}} medidos',
    unsizedSuffix: ' · {{count}} sin calcular',
    scanningFallback: 'Escaneando…',
    phase: {
      discover: 'Descubrir',
      classify: 'Clasificar',
      size: 'Medir',
      done: 'Hecho',
      cleanup: 'Limpieza',
    },
  },
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

console.log('Merged v0.8.3 phase-2 locale keys');
