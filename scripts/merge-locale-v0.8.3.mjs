#!/usr/bin/env node
/** Merges v0.8.3 locale keys into messages/{en,cn,es}.json */
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
    reset: 'Reset',
    delete: 'Delete',
    show: 'Show',
    allDrives: 'All drives',
    anyTime: 'Any time',
    localDisk: 'Local Disk',
  },
  dashboard: {
    partition: {
      title: 'Partitions to scan',
      description:
        'Each selected drive includes its volume root (e.g. D:\\) so top-level trees are scanned; system folders are skipped.',
      addDrive: 'Add drive',
      choosePartition: 'Choose a partition…',
      allDrivesSelected: 'All drives already selected',
      selected: 'Selected: {{list}}',
      detecting: 'Detecting local storage…',
      freeOf: '{{free}} free of {{total}}',
      volumeKind: '({{kind}})',
      devFolders: 'Also scan dev folders on selected drives (Users\\…\\Projects, source, code, …)',
      allFixedDrives: 'All fixed drives',
      clear: 'Clear',
    },
    quickUpdateBanner: {
      title: 'Use Quick update for your next scan',
      description:
        'After a full scan, Quick update reuses the path inventory and skips re-measuring unchanged folders. On HDDs this often finishes in seconds instead of minutes — ideal for repeat checks when you have not changed profile or discovery options.',
      action: 'Quick update',
      dismiss: 'Dismiss',
    },
    summary: {
      scope: 'scope {{scope}}',
      profile: '{{profile}} profile',
      depth: 'depth {{depth}}',
      size: 'size {{mode}}',
      quickUpdateOn: 'Quick update on',
    },
  },
  history: {
    title: 'Scan History',
    description: 'Review previous scan sessions and their reclaimed space.',
    clearAll: 'Clear all',
    filters: 'Filters',
    sizeMin: 'Size (min)',
    sizeMax: 'Size (max)',
    when: 'When',
    partition: 'Partition / drive',
    showing: 'Showing {{filtered}} of {{total}} records',
    roots: 'Roots: {{list}}',
    drives: 'Drives: {{list}}',
    meta: '{{count}} candidates · profile {{profile}}{{safe}}',
    safeSuffix: ' · {{count}} safe',
    recovered: 'Recovered',
    reuseConfig: 'Reuse Config',
    noMatch: 'No records match these filters.',
    clearFilters: 'Clear filters',
    empty: 'No history available.',
    deleteTitle: 'Delete scan record?',
    deleteDescription: 'Remove the scan from {{label}}? This cannot be undone.',
    clearTitle: 'Clear all scan history?',
    clearDescription:
      'Remove all {{count}} scan records from this device? This cannot be undone.',
    timeRange: {
      all: 'Any time',
      '1h': 'Past 1 hour',
      '24h': 'Past 24 hours',
      '7d': 'Past 7 days',
      '30d': 'Past 30 days',
    },
  },
  quarantine: {
    title: 'Quarantine',
    description:
      'Temporarily held folders — restore anytime, or purge items older than {{days}} days.',
    refresh: 'Refresh',
    exportLog: 'Export log',
    purgeEligible: 'Purge eligible',
    purgeNone: 'No items are older than {{days}} days yet.',
    searchPlaceholder: 'Search by path or id…',
    purgeEligibleOnly: 'Purge-eligible only',
    selectAll: 'Select all ({{count}})',
    showing: 'Showing {{filtered}} of {{total}}',
    held: '{{size}} held',
    restoreSelected: 'Restore selected ({{count}})',
    purgeEligibleBadge: 'Purge eligible',
    daysUntilPurge: '{{days}}d until purge',
    emptyTitle: 'Quarantine is empty.',
    emptyDescription:
      'Cleaned folders appear here until you restore them or they are purged after the retention period.',
    goToDashboard: 'Go to Dashboard',
    restore: 'Restore',
    noMatch: 'No entries match these filters.',
    purgeTitle: 'Purge eligible quarantine items?',
    purgeDescription:
      'Permanently remove {{count}} item(s) older than {{days}} days? This cannot be undone.',
    purgeNoneEligible: 'No items are eligible for purge.',
    purge: 'Purge',
  },
  status: {
    systemReady: 'System Ready',
    ready: 'Ready',
    scanStarted: 'Scan started',
    quickUpdateStarted: 'Quick update started',
  },
};

const cn = {
  common: {
    reset: '重置',
    delete: '删除',
    show: '显示',
    allDrives: '所有驱动器',
    anyTime: '任何时间',
    localDisk: '本地磁盘',
  },
  dashboard: {
    partition: {
      title: '要扫描的分区',
      description: '每个所选驱动器包含其卷根目录（例如 D:\\），将扫描顶层目录树；跳过系统文件夹。',
      addDrive: '添加驱动器',
      choosePartition: '选择分区…',
      allDrivesSelected: '已选择所有驱动器',
      selected: '已选：{{list}}',
      detecting: '正在检测本地存储…',
      freeOf: '{{free}} 可用，共 {{total}}',
      volumeKind: '({{kind}})',
      devFolders: '同时扫描所选驱动器上的开发文件夹（Users\\…\\Projects、source、code 等）',
      allFixedDrives: '所有固定驱动器',
      clear: '清除',
    },
    quickUpdateBanner: {
      title: '下次扫描请使用快速更新',
      description:
        '完整扫描后，快速更新会复用路径清单并跳过对未更改文件夹的重新测量。在 HDD 上通常只需数秒而非数分钟 — 在未更改配置文件或发现选项时非常适合重复检查。',
      action: '快速更新',
      dismiss: '关闭',
    },
    summary: {
      scope: '范围 {{scope}}',
      profile: '{{profile}} 配置文件',
      depth: '深度 {{depth}}',
      size: '大小 {{mode}}',
      quickUpdateOn: '快速更新开启',
    },
  },
  history: {
    title: '扫描历史',
    description: '查看过往扫描会话及其可回收空间。',
    clearAll: '全部清除',
    filters: '筛选',
    sizeMin: '大小（最小）',
    sizeMax: '大小（最大）',
    when: '时间',
    partition: '分区 / 驱动器',
    showing: '显示 {{filtered}} / {{total}} 条记录',
    roots: '根路径：{{list}}',
    drives: '驱动器：{{list}}',
    meta: '{{count}} 个候选 · 配置文件 {{profile}}{{safe}}',
    safeSuffix: ' · {{count}} 个安全',
    recovered: '可释放',
    reuseConfig: '复用配置',
    noMatch: '没有记录匹配这些筛选条件。',
    clearFilters: '清除筛选',
    empty: '暂无历史记录。',
    deleteTitle: '删除扫描记录？',
    deleteDescription: '从 {{label}} 删除此扫描？此操作无法撤销。',
    clearTitle: '清除所有扫描历史？',
    clearDescription: '从此设备删除全部 {{count}} 条扫描记录？此操作无法撤销。',
    timeRange: {
      all: '任何时间',
      '1h': '过去 1 小时',
      '24h': '过去 24 小时',
      '7d': '过去 7 天',
      '30d': '过去 30 天',
    },
  },
  quarantine: {
    title: '隔离区',
    description: '临时保留的文件夹 — 可随时恢复，或清除超过 {{days}} 天的项目。',
    refresh: '刷新',
    exportLog: '导出日志',
    purgeEligible: '清除符合条件项',
    purgeNone: '尚无超过 {{days}} 天的项目。',
    searchPlaceholder: '按路径或 ID 搜索…',
    purgeEligibleOnly: '仅显示可清除项',
    selectAll: '全选 ({{count}})',
    showing: '显示 {{filtered}} / {{total}}',
    held: '占用 {{size}}',
    restoreSelected: '恢复所选 ({{count}})',
    purgeEligibleBadge: '可清除',
    daysUntilPurge: '还有 {{days}} 天可清除',
    emptyTitle: '隔离区为空。',
    emptyDescription: '清理的文件夹会显示在此处，直到您恢复它们或超过保留期后被清除。',
    goToDashboard: '前往仪表盘',
    restore: '恢复',
    noMatch: '没有条目匹配这些筛选条件。',
    purgeTitle: '清除符合条件的隔离项？',
    purgeDescription: '永久删除超过 {{days}} 天的 {{count}} 个项目？此操作无法撤销。',
    purgeNoneEligible: '没有符合清除条件的项目。',
    purge: '清除',
  },
  status: {
    systemReady: '系统就绪',
    ready: '就绪',
    scanStarted: '扫描已开始',
    quickUpdateStarted: '快速更新已开始',
  },
};

const es = {
  common: {
    reset: 'Restablecer',
    delete: 'Eliminar',
    show: 'Mostrar',
    allDrives: 'Todas las unidades',
    anyTime: 'Cualquier momento',
    localDisk: 'Disco local',
  },
  dashboard: {
    partition: {
      title: 'Particiones a escanear',
      description:
        'Cada unidad seleccionada incluye la raíz del volumen (p. ej. D:\\) para escanear árboles de nivel superior; se omiten carpetas del sistema.',
      addDrive: 'Añadir unidad',
      choosePartition: 'Elegir partición…',
      allDrivesSelected: 'Todas las unidades ya están seleccionadas',
      selected: 'Seleccionado: {{list}}',
      detecting: 'Detectando almacenamiento local…',
      freeOf: '{{free}} libres de {{total}}',
      volumeKind: '({{kind}})',
      devFolders:
        'También escanear carpetas de desarrollo en las unidades seleccionadas (Users\\…\\Projects, source, code, …)',
      allFixedDrives: 'Todas las unidades fijas',
      clear: 'Borrar',
    },
    quickUpdateBanner: {
      title: 'Use actualización rápida en su próximo escaneo',
      description:
        'Tras un escaneo completo, la actualización rápida reutiliza el inventario de rutas y omite volver a medir carpetas sin cambios. En HDD suele terminar en segundos en lugar de minutos.',
      action: 'Actualización rápida',
      dismiss: 'Descartar',
    },
    summary: {
      scope: 'alcance {{scope}}',
      profile: 'perfil {{profile}}',
      depth: 'profundidad {{depth}}',
      size: 'tamaño {{mode}}',
      quickUpdateOn: 'actualización rápida activa',
    },
  },
  history: {
    title: 'Historial de escaneos',
    description: 'Revise sesiones de escaneo anteriores y el espacio recuperado.',
    clearAll: 'Borrar todo',
    filters: 'Filtros',
    sizeMin: 'Tamaño (mín.)',
    sizeMax: 'Tamaño (máx.)',
    when: 'Cuándo',
    partition: 'Partición / unidad',
    showing: 'Mostrando {{filtered}} de {{total}} registros',
    roots: 'Raíces: {{list}}',
    drives: 'Unidades: {{list}}',
    meta: '{{count}} candidatos · perfil {{profile}}{{safe}}',
    safeSuffix: ' · {{count}} seguros',
    recovered: 'Recuperado',
    reuseConfig: 'Reutilizar config.',
    noMatch: 'Ningún registro coincide con estos filtros.',
    clearFilters: 'Borrar filtros',
    empty: 'No hay historial disponible.',
    deleteTitle: '¿Eliminar registro de escaneo?',
    deleteDescription: '¿Eliminar el escaneo de {{label}}? No se puede deshacer.',
    clearTitle: '¿Borrar todo el historial de escaneos?',
    clearDescription:
      '¿Eliminar los {{count}} registros de escaneo de este equipo? No se puede deshacer.',
    timeRange: {
      all: 'Cualquier momento',
      '1h': 'Última hora',
      '24h': 'Últimas 24 horas',
      '7d': 'Últimos 7 días',
      '30d': 'Últimos 30 días',
    },
  },
  quarantine: {
    title: 'Cuarentena',
    description:
      'Carpetas retenidas temporalmente — restáurelas cuando quiera o purgue las de más de {{days}} días.',
    refresh: 'Actualizar',
    exportLog: 'Exportar registro',
    purgeEligible: 'Purgar elegibles',
    purgeNone: 'Aún no hay elementos de más de {{days}} días.',
    searchPlaceholder: 'Buscar por ruta o id…',
    purgeEligibleOnly: 'Solo elegibles para purga',
    selectAll: 'Seleccionar todo ({{count}})',
    showing: 'Mostrando {{filtered}} de {{total}}',
    held: '{{size}} retenidos',
    restoreSelected: 'Restaurar selección ({{count}})',
    purgeEligibleBadge: 'Elegible para purga',
    daysUntilPurge: '{{days}}d para purga',
    emptyTitle: 'La cuarentena está vacía.',
    emptyDescription:
      'Las carpetas limpiadas aparecen aquí hasta que las restaure o se purguen tras el periodo de retención.',
    goToDashboard: 'Ir al panel',
    restore: 'Restaurar',
    noMatch: 'Ninguna entrada coincide con estos filtros.',
    purgeTitle: '¿Purgar elementos elegibles de la cuarentena?',
    purgeDescription:
      '¿Eliminar permanentemente {{count}} elemento(s) de más de {{days}} días? No se puede deshacer.',
    purgeNoneEligible: 'No hay elementos elegibles para purga.',
    purge: 'Purgar',
  },
  status: {
    systemReady: 'Sistema listo',
    ready: 'Listo',
    scanStarted: 'Escaneo iniciado',
    quickUpdateStarted: 'Actualización rápida iniciada',
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

console.log('Merged v0.8.3 locale keys into en.json, cn.json, es.json');
