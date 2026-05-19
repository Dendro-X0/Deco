#!/usr/bin/env node
/** Generates apps/frontend/src/i18n/messages/{en,cn,es}.json with identical key structure. */
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../apps/frontend/src/i18n/messages');

const en = {
  nav: {
    dashboard: 'Dashboard',
    quarantine: 'Quarantine',
    history: 'History',
    settings: 'Settings',
  },
  status: { label: 'Status' },
  common: {
    save: 'Save changes',
    saving: 'Saving…',
    discard: 'Discard changes',
    custom: 'Custom',
    sizing: 'Sizing…',
    notApplicable: 'N/A',
  },
  header: {
    dashboard: {
      default: 'Scan, review candidates, and reclaim disk space.',
      searchStopped:
        'Directory search stopped. Sizing found items — click Stop analysis to skip the rest.',
    },
    quarantine: 'Restore or permanently purge held folders.',
    history: 'Review past scans and reuse configurations.',
    settings: 'Configure scan targets, safety, and discovery options.',
  },
  dashboard: {
    actions: {
      freeUpSpace: 'Free up space',
      scanNow: 'Scan Now',
      quickUpdate: 'Quick update',
      recommended: 'Recommended',
      quickUpdateTitleRecommended:
        'Recommended for repeat scans — reuses inventory; much faster on HDD when paths are unchanged.',
      quickUpdateTitleDefault:
        'Reuse cached classify/size for unchanged paths. Run a full scan after changing profile or discovery options.',
      cleanSelected: 'Clean selected…',
    },
    empty: {
      title: 'Need more disk space?',
      description:
        'Run the guided flow to scan your projects, review safe targets, and quarantine clutter with one click — nothing is permanently deleted until you purge quarantine.',
      cta: 'Start guided cleanup',
    },
    stats: {
      safe: 'Safe',
      review: 'Review',
      blocked: 'Blocked',
      totalReclaimable: 'Total Reclaimable',
      noScanYet: 'No scan yet',
      itemsDiscovered: '{{count}} items discovered',
    },
    scanTargets: {
      title: 'Scan targets',
      ready: 'Choose drives or folders, then run Scan Now.',
      notReady: 'Select at least one drive or custom folder before scanning.',
      profile: 'Profile',
      strategy: 'Strategy',
      notReadyBadge: 'Not ready',
      profiles: {
        safe: 'Safe (Conservative)',
        balanced: 'Balanced',
        aggressive: 'Aggressive',
      },
    },
    scanMode: {
      partition: 'Disk partitions',
      custom: 'Custom directories',
    },
    candidates: {
      searchPlaceholder: 'Search path or kind…',
      selected: '{{count}} selected',
      showingFiltered: 'Showing {{filtered}} of {{total}}',
      candidateCount: '{{count}} candidates',
      projectCount: '{{count}} projects',
      clickHeadersToSort: 'Click headers to sort',
      groupedByProject: 'Grouped by project',
      flatList: 'Flat list',
      groupHint: 'Recommended for large scans — expand a project to see each artifact.',
      searchStoppedBanner:
        'Directory search has stopped. Sizes are still being calculated — use Stop analysis in the header to skip the rest. Rows without a size yet show Sizing….',
      stopAnalysis: 'Stop analysis',
      noCandidates: 'No candidates found.',
      table: {
        risk: 'Risk',
        kind: 'Kind',
        path: 'Path',
        stale: 'Stale',
        size: 'Size',
      },
      units: { projects: 'projects', items: 'items' },
    },
    filters: {
      title: 'Filters',
      clearAll: 'Clear all',
      risk: 'Risk',
      allRisks: 'All risks',
      allKinds: 'All kinds',
    },
    detail: {
      title: 'Candidate Detail',
      path: 'Path',
      showInExplorer: 'Show in File Explorer',
      reason: 'Reason',
      project: 'Project',
      dormancy: 'Dormancy',
      regenerate: 'Regenerate',
      size: 'Size',
      reasonCodes: 'Reason Codes',
      selectPrompt: 'Select an item to inspect its metadata.',
      gitLoading: 'Loading git last-commit hint…',
      gitNone: 'No git history for this path (or git unavailable).',
    },
    planner: {
      title: 'Free Space Planner',
      noScan:
        'Run a scan to see how much space you can reclaim, then set a target and auto-select candidates.',
      reclaimable: 'Reclaimable from scan',
      safeLegend: 'Safe',
      reviewLegend: 'Review',
      targetGb: 'Target: {{gb}} GB',
      targetLabel: 'Target to free (GB)',
      targetAria: 'Target to free in gigabytes',
      sliderAria: 'Target gigabytes slider',
      planSafe: 'Plan safe',
      planReview: 'Incl. review',
      previewCleanup: 'Preview cleanup',
      runScanFirst: 'Run a scan first.',
      selectedSummary:
        'Selected {{count}} folders (~{{achievable}}). Target was {{target}}.',
      targetNotReached:
        'Could not reach that target with current scan results. Try a lower goal or include review-tier items.',
    },
    lastScan: {
      title: 'Last scan',
      history: 'History',
      reclaimable: 'Reclaimable',
      candidates: 'Candidates',
      profile: 'Profile',
      mode: 'Mode',
      reuse: 'Reuse scan',
      modes: { partition: 'Partitions', custom: 'Custom folders' },
    },
    scanScope: {
      projects: 'project folders',
      drives: 'local drives',
      all: 'projects + drives',
    },
  },
  settings: {
    loading: 'Loading settings…',
    title: 'Global Configuration',
    description:
      'Safety profile, discovery options, and advanced scan behavior. Configure drives and folders on the Dashboard. Changes apply after you save.',
    unsaved: 'Unsaved changes',
    language: {
      title: 'Language',
      description: 'UI language for labels and navigation. Stored on this device.',
      field: 'Display language',
      en: 'English',
      es: 'Español',
      cn: '中文',
    },
    updates: {
      title: 'Updates',
      description: 'Desktop builds are distributed via GitHub Releases (Windows MSI / NSIS).',
      checkTitle: 'Check for updates',
      checkDescription:
        'Compares this install with the latest release on GitHub Releases · detected {{platform}}.',
      githubReleases: 'GitHub Releases',
      checkAgain: 'Check again',
      checking: 'Checking…',
      installed: 'Installed',
      contacting: 'Contacting GitHub…',
      latest: 'You are on the latest release ({{tag}}).',
      checkedAt: '· checked {{time}}',
      updateAvailable: 'Update available: {{tag}} (you have v{{version}})',
      savedTo: 'Saved to',
      installFinish: ' — follow the installer to finish, then restart Deco.',
      extractManual: ' — extract or install manually, then restart Deco.',
      releaseNotes: 'Release notes',
      downloadInstall: 'Download & install',
      downloading: 'Downloading…',
      install: 'Install',
      browser: 'Browser',
    },
    scanBehavior: {
      title: 'Scan behavior',
      descriptionPartition:
        'Pick a cleanup profile for your role, then tune scan strategy and thresholds. Scan scope applies when suggesting roots on empty drives.',
      descriptionCustom:
        'Pick a cleanup profile for your role, then tune scan strategy and thresholds. Custom-folder mode ignores partition layout.',
      cleanupProfile: 'Cleanup profile',
      scanStrategy: 'Scan strategy',
      customMismatchProfile:
        'Safety profile, discovery flags, or scope no longer match a preset — adjust below or pick a profile.',
      customMismatchStrategy:
        'Depth, size parallelism, or Quick update no longer match a preset — adjust below or pick a preset.',
      profileBundleHint:
        'Bundles scope, safety profile, discovery flags, and scan strategy.',
      strategyBundleHint: 'Maps to search depth, size parallelism, and Quick update.',
      scanScope: 'Scan scope',
      safetyProfile: 'Safety profile',
      staleThreshold: 'Stale threshold (days)',
      staleAria: 'Stale threshold in days',
      performance: {
        title: 'Performance tuning',
        hint: 'Adjusting these may switch the strategy to Custom.',
        maxDepth: 'Max search depth',
        maxDepthAria: 'Max search depth',
        workers: 'Parallel workers (discover / size / delete)',
        gitDormancy: 'Git dormancy hint (candidate detail)',
        gitDormancyDesc:
          'When a candidate is selected, run git log for last commit touching that path. Opt-in; does not affect scan speed.',
        quickUpdate: 'Incremental inventory (Quick update)',
        quickUpdateDesc:
          'Reuse classify and size for unchanged paths. Run a full scan after changing profile or discovery options.',
        fastSize: 'Fast size estimate for dependency trees',
        fastSizeDesc:
          'Sample top-level packages in node_modules, target, and similar folders instead of walking every file (shows ~size). Reduces 30s timeouts on huge trees.',
      },
    },
    discovery: {
      title: 'Discovery',
      description: 'Optional artifact targets during scans.',
      shiftHint: 'Shift+click to toggle a range between two rows.',
      enabledCount: '{{enabled}}/{{total}} on',
      selectAll: 'Select all',
      clearAll: 'Clear all',
      categories: {
        general: { label: 'General', description: 'Scan performance and high-risk project targets.' },
        package_managers: {
          label: 'Package managers',
          description: 'Global caches for Node, Python, Conda, bun, NuGet, and Composer (review tier).',
        },
        language_runtimes: {
          label: 'Language runtimes',
          description: 'Compiler and runtime caches outside individual projects.',
        },
        ide_tooling: {
          label: 'IDE & tooling',
          description: 'Editor and SDK global caches.',
        },
      },
      options: {
        include_size: { label: 'Calculate sizes', description: 'Turn off for a faster scan (CLI: --no-size).' },
        include_python_venv: {
          label: 'Include Python venv',
          description: 'venv / .venv when a Python project is detected (high risk).',
        },
        check_npm_cache: {
          label: 'npm cache',
          description: 'npm cache directory with _cacache (regenerate: npm cache clean).',
        },
        check_pnpm_store: {
          label: 'pnpm store',
          description:
            'Global store and project `.pnpm-store` folders (v3 marker); respects PNPM_STORE_PATH / pnpm store path.',
        },
        check_yarn_cache: {
          label: 'Yarn cache',
          description: 'Yarn Classic (v6) or Berry global cache; uses yarn cache dir when available.',
        },
        check_pip_cache: {
          label: 'pip cache',
          description: 'pip download cache (wheels/http); regen with pip cache purge.',
        },
        check_uv_cache: {
          label: 'uv cache',
          description: 'uv package cache; respects UV_CACHE_DIR / uv cache dir.',
        },
        check_conda_pkgs_cache: {
          label: 'Conda pkgs cache',
          description: 'Conda/Miniconda package cache (pkgs only; never envs/). Regenerate: conda clean.',
        },
        check_bun_cache: {
          label: 'bun cache',
          description: 'Global bun install cache; respects BUN_INSTALL_CACHE_DIR.',
        },
        check_nuget_cache: {
          label: 'NuGet global packages',
          description: 'NuGet package store (NUGET_PACKAGES or ~/.nuget/packages).',
        },
        check_composer_cache: {
          label: 'Composer cache',
          description: 'PHP Composer cache (COMPOSER_CACHE_DIR or ~/.composer/cache).',
        },
        check_go_cache: {
          label: 'Global Go cache',
          description: 'Opt-in scan for GOCACHE and GOMODCACHE via go env.',
        },
        check_cargo_registry: {
          label: 'Cargo registry cache',
          description: 'CARGO_HOME/registry with downloaded crates (regenerate: cargo cache -a).',
        },
        check_vcpkg_cache: {
          label: 'vcpkg installed tree',
          description: 'VCPKG_ROOT/installed ports (review; reinstall with vcpkg install).',
        },
        check_conan_cache: {
          label: 'Conan package cache',
          description: 'Conan 2 global package cache (.conan2/p; review tier).',
        },
        check_ccache: {
          label: 'ccache',
          description: 'Compiler object cache (CCACHE_DIR or ~/.cache/ccache; review tier).',
        },
        check_sccache: {
          label: 'sccache',
          description: 'Shared compiler cache (SCCACHE_DIR; review tier).',
        },
        check_bazel_disk_cache: {
          label: 'Bazel disk cache',
          description:
            'When BAZEL_DISK_CACHE points at a directory with Bazel disk-cache layout (cas/ac subdirs; review tier).',
        },
        check_jvm_global_cache: {
          label: 'Global JVM caches',
          description: '~/.m2/repository and ~/.gradle/caches (review tier).',
        },
        check_ide_global_cache: {
          label: 'IDE global caches',
          description: 'Xcode DerivedData plus JetBrains/Android Studio caches when smart discovery is on.',
        },
        smart_discovery_enabled: {
          label: 'Smart discovery',
          description:
            'Match declarative path patterns (e.g. Android Studio caches) to registered kinds. Requires the matching opt-in flags.',
        },
      },
    },
    policyPack: {
      title: 'Policy pack gallery',
      description:
        'Browse shipped examples, preview JSON, see replace diff, and apply .deco/disk-cleanup.json to a project.',
      intro:
        'Shipped examples from the repo gallery. Select one to preview JSON, then apply to a project folder.',
      loading: 'Loading gallery…',
      browseCustom: 'Browse custom pack…',
      opening: 'Opening…',
      previewTitle: 'Preview — {{title}}',
      applyToProject: 'Apply to project',
      noFolder: 'No folder selected.',
      chooseFolder: 'Choose project folder…',
      validationOk: 'Validation OK',
      incoming: 'Incoming',
      current: 'Current',
      replacePreview: 'Replace preview (top-level)',
      replaceWarning:
        'The entire file will be replaced; merge fields manually if needed.',
      validationFailed: 'Validation failed.',
      applied: 'Applied — wrote',
      revealExplorer: 'Reveal in Explorer',
      applying: 'Applying…',
      apply: 'Apply policy pack',
      customPack: 'Custom pack',
      defaultTitle: 'Policy pack',
    },
    safety: {
      title: 'Safety',
      description: 'How cleanup frees space. Use Delete when the drive is almost full.',
      deleteMode: 'Delete mode',
      deleteInPlace: 'Delete in place (recommended) — frees space immediately, no copy',
      quarantineSameDrive: 'Quarantine on same drive — moves to .deco-quarantine, restorable',
      deleteHint:
        'Delete in place does not store backups. Use it when cleaning C: or when the disk is almost full.',
      cleanupDiskMode: 'Cleanup disk mode',
      diskAuto: 'Auto — conservative on large batches',
      diskHdd: 'HDD / sequential — one folder at a time',
      diskStandard: 'Standard — follow scan worker count',
      diskHint:
        'HDD mode deletes one tree at a time (best for mechanical drives). Pause/resume is available during cleanup.',
      fastDelete: 'Fast delete for dependency trees (experimental)',
      fastDeleteDesc:
        'When deleting in place, removes node_modules, target, and build folders via system commands (Windows rmdir /s /q, Unix rm -rf). Parallelism follows Settings → Cleanup disk mode (HDD = one tree at a time) and Scan behavior → Performance. Not used for quarantine.',
      quarantineStorage: 'Quarantine storage',
      quarantineEnableHint:
        'Enable by choosing “Quarantine on same drive” above. Payloads are never stored under AppData unless you pick that folder yourself.',
      quarantinePerDrive: 'On each source drive — {drive}\\.deco-quarantine (recommended)',
      quarantineCustom: 'Custom folder — you choose the path',
      quarantinePlaceholder: 'e.g. E:\\DecoQuarantine',
      browse: 'Browse…',
      systemDriveWarning:
        'This folder is on the system (C:) drive — quarantine will use space on C:.',
      advancedMode: 'Advanced mode',
      advancedDesc: 'Enables hard-delete and experimental classifiers.',
      classifyThreshold: 'Classify parallel threshold',
      classifyAria: 'Minimum targets before parallel classify',
      classifyHint: 'Rayon classify runs when a chunk has at least this many targets (default 8).',
    },
    presets: {
      cleanup: {
        first_scan: {
          label: 'First scan',
          description:
            'Conservative safety, thorough walk, all scope — audit before enabling global caches.',
        },
        monorepo_maintainer: {
          label: 'Monorepo maintainer',
          description:
            'Balanced defaults with package-manager and registry caches plus smart IDE patterns.',
        },
        ci_agent: {
          label: 'CI agent',
          description: 'Fast shallow pass, drive roots, compiler caches — typical build-agent reclaim.',
        },
      },
      scanStrategy: {
        thorough: {
          label: 'Thorough',
          description: 'Deeper search, balanced parallelism — best for first scan or audit.',
        },
        balanced: {
          label: 'Balanced',
          description: 'Default trade-off for most machines and repeat scans.',
        },
        fast: {
          label: 'Fast',
          description: 'Shallower walk, 8 parallel workers — SSD / NVMe friendly.',
        },
        background: {
          label: 'Background',
          description: 'Gentle disk use — 2 workers, shallow walk (HDD).',
        },
      },
      scanScope: {
        all: 'All — dev folders + drives (recommended)',
        projects: 'Projects — profile folders only',
        drives: 'Drives — partition roots only',
      },
      safetyProfile: {
        safe: 'Safe (Conservative)',
        balanced: 'Balanced',
        aggressive: 'Aggressive (Maximum Space)',
      },
      concurrency: {
        auto: 'Auto — 6 parallel workers (recommended)',
        low: 'Low — 2 workers (HDD / background)',
        high: 'High — 8 workers (fast SSD)',
      },
      cleanupDiskMode: {
        auto: 'Auto — conservative on large batches',
        hdd: 'HDD / sequential — one folder at a time',
        standard: 'Standard — follow scan worker count',
      },
    },
  },
};

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

const cn = structuredClone(en);
deepAssign(cn, {
  nav: { dashboard: '仪表盘', quarantine: '隔离区', history: '历史', settings: '设置' },
  status: { label: '状态' },
  common: {
    save: '保存更改',
    saving: '保存中…',
    discard: '放弃更改',
    custom: '自定义',
    sizing: '计算大小中…',
    notApplicable: '不适用',
  },
});

const es = structuredClone(en);
deepAssign(es, {
  nav: { dashboard: 'Panel', quarantine: 'Cuarentena', history: 'Historial', settings: 'Ajustes' },
  status: { label: 'Estado' },
  common: {
    save: 'Guardar cambios',
    saving: 'Guardando…',
    discard: 'Descartar cambios',
    custom: 'Personalizado',
    sizing: 'Calculando tamaño…',
    notApplicable: 'N/D',
  },
});

// Full CN/ES overrides for dashboard + settings (abbreviated via deepAssign blocks in repo)
// eslint-disable-next-line no-unused-vars
function applyLocaleOverrides(locale, tree) {
  deepAssign(locale, tree);
}

applyLocaleOverrides(cn, {
  header: {
    dashboard: {
      default: '扫描、审阅候选项并回收磁盘空间。',
      searchStopped: '目录搜索已停止。正在计算已找到项的大小 — 点击标题栏中的“停止分析”以跳过剩余部分。',
    },
    quarantine: '恢复或永久清除已隔离的文件夹。',
    history: '查看过往扫描并复用配置。',
    settings: '配置扫描目标、安全选项和发现选项。',
  },
  dashboard: {
    actions: {
      freeUpSpace: '释放空间',
      scanNow: '立即扫描',
      quickUpdate: '快速更新',
      recommended: '推荐',
      quickUpdateTitleRecommended:
        '推荐用于重复扫描 — 复用清单；路径未变时在 HDD 上快得多。',
      quickUpdateTitleDefault:
        '对未更改路径复用缓存的分类/大小。更改配置文件或发现选项后请运行完整扫描。',
      cleanSelected: '清理所选…',
    },
    empty: {
      title: '需要更多磁盘空间？',
      description:
        '运行引导流程扫描项目、审阅安全目标，并一键隔离杂物 — 在您清除隔离区之前不会永久删除。',
      cta: '开始引导清理',
    },
    stats: {
      safe: '安全',
      review: '审阅',
      blocked: '已阻止',
      totalReclaimable: '可释放总计',
      noScanYet: '尚未扫描',
      itemsDiscovered: '发现 {{count}} 项',
    },
    scanTargets: {
      title: '扫描目标',
      ready: '选择驱动器或文件夹，然后点击“立即扫描”。',
      notReady: '扫描前请至少选择一个驱动器或自定义文件夹。',
      profile: '配置文件',
      strategy: '策略',
      notReadyBadge: '未就绪',
      profiles: { safe: '安全（保守）', balanced: '平衡', aggressive: '激进' },
    },
    scanMode: { partition: '磁盘分区', custom: '自定义目录' },
    candidates: {
      searchPlaceholder: '搜索路径或类型…',
      selected: '已选 {{count}} 项',
      showingFiltered: '显示 {{filtered}} / {{total}}',
      candidateCount: '{{count}} 个候选',
      projectCount: '{{count}} 个项目',
      clickHeadersToSort: '点击表头排序',
      groupedByProject: '按项目分组',
      flatList: '平铺列表',
      groupHint: '建议用于大型扫描 — 展开项目以查看每个构件。',
      searchStoppedBanner:
        '目录搜索已停止。仍在计算大小 — 使用标题栏中的“停止分析”跳过剩余部分。尚无大小的行显示“计算大小中…”。',
      stopAnalysis: '停止分析',
      noCandidates: '未找到候选。',
      table: { risk: '风险', kind: '类型', path: '路径', stale: '陈旧', size: '大小' },
      units: { projects: '个项目', items: '项' },
    },
    filters: {
      title: '筛选',
      clearAll: '全部清除',
      risk: '风险',
      allRisks: '全部风险',
      allKinds: '全部类型',
    },
    detail: {
      title: '候选详情',
      path: '路径',
      showInExplorer: '在文件资源管理器中显示',
      reason: '原因',
      project: '项目',
      dormancy: '休眠',
      regenerate: '重新生成',
      size: '大小',
      reasonCodes: '原因代码',
      selectPrompt: '选择一项以查看其元数据。',
      gitLoading: '正在加载 git 最后提交提示…',
      gitNone: '此路径无 git 历史（或 git 不可用）。',
    },
    planner: {
      title: '释放空间规划器',
      noScan: '运行扫描以查看可释放空间，然后设置目标并自动选择候选。',
      reclaimable: '本次扫描可释放',
      safeLegend: '安全',
      reviewLegend: '审阅',
      targetGb: '目标：{{gb}} GB',
      targetLabel: '目标释放量 (GB)',
      targetAria: '目标释放千兆字节',
      sliderAria: '目标千兆字节滑块',
      planSafe: '规划安全项',
      planReview: '含审阅项',
      previewCleanup: '预览清理',
      runScanFirst: '请先运行扫描。',
      selectedSummary: '已选 {{count}} 个文件夹（约 {{achievable}}）。目标为 {{target}}。',
      targetNotReached: '无法在当前扫描结果中达到该目标。请降低目标或包含审阅级项。',
    },
    lastScan: {
      title: '上次扫描',
      history: '历史',
      reclaimable: '可释放',
      candidates: '候选',
      profile: '配置文件',
      mode: '模式',
      reuse: '复用扫描',
      modes: { partition: '分区', custom: '自定义文件夹' },
    },
    scanScope: { projects: '项目文件夹', drives: '本地驱动器', all: '项目 + 驱动器' },
  },
  settings: {
    loading: '正在加载设置…',
    title: '全局配置',
    description:
      '安全配置文件、发现选项和高级扫描行为。在仪表盘上配置驱动器和文件夹。保存后生效。',
    unsaved: '未保存的更改',
    language: {
      title: '语言',
      description: '界面标签和导航的语言。存储在本设备上。',
      field: '显示语言',
      cn: '中文',
    },
    updates: {
      title: '更新',
      description: '桌面版通过 GitHub Releases 分发（Windows MSI / NSIS）。',
      checkTitle: '检查更新',
      checkDescription: '将此安装与 GitHub Releases 上的最新版本比较 · 检测到 {{platform}}。',
      githubReleases: 'GitHub Releases',
      checkAgain: '再次检查',
      checking: '检查中…',
      installed: '已安装',
      contacting: '正在联系 GitHub…',
      latest: '您已使用最新版本 ({{tag}})。',
      checkedAt: '· 检查于 {{time}}',
      updateAvailable: '有可用更新：{{tag}}（当前 v{{version}}）',
      savedTo: '已保存至',
      installFinish: ' — 按照安装程序完成，然后重启 Deco。',
      extractManual: ' — 手动解压或安装，然后重启 Deco。',
      releaseNotes: '发行说明',
      downloadInstall: '下载并安装',
      downloading: '下载中…',
      install: '安装',
      browser: '浏览器',
    },
    scanBehavior: {
      title: '扫描行为',
      descriptionPartition:
        '选择适合您角色的清理配置文件，然后调整扫描策略和阈值。扫描范围在空驱动器上建议根路径时适用。',
      descriptionCustom:
        '选择适合您角色的清理配置文件，然后调整扫描策略和阈值。自定义文件夹模式忽略分区布局。',
      cleanupProfile: '清理配置文件',
      scanStrategy: '扫描策略',
      customMismatchProfile:
        '安全配置文件、发现标志或范围不再匹配预设 — 请在下方调整或选择配置文件。',
      customMismatchStrategy:
        '深度、大小并行或快速更新不再匹配预设 — 请在下方调整或选择预设。',
      profileBundleHint: '捆绑范围、安全配置文件、发现标志和扫描策略。',
      strategyBundleHint: '映射到搜索深度、大小并行和快速更新。',
      scanScope: '扫描范围',
      safetyProfile: '安全配置文件',
      staleThreshold: '陈旧阈值（天）',
      staleAria: '陈旧阈值（天）',
      performance: {
        title: '性能调优',
        hint: '调整这些可能会将策略切换为自定义。',
        maxDepth: '最大搜索深度',
        maxDepthAria: '最大搜索深度',
        workers: '并行工作线程（发现 / 大小 / 删除）',
        gitDormancy: 'Git 休眠提示（候选详情）',
        gitDormancyDesc:
          '选中候选时，对此路径运行 git log 获取最后提交。可选；不影响扫描速度。',
        quickUpdate: '增量清单（快速更新）',
        quickUpdateDesc:
          '对未更改路径复用分类和大小。更改配置文件或发现选项后请运行完整扫描。',
        fastSize: '依赖树快速大小估算',
        fastSizeDesc:
          '对 node_modules、target 等文件夹采样顶层包，而非遍历每个文件（显示约略大小）。',
      },
    },
    discovery: {
      title: '发现',
      description: '扫描期间的可选构件目标。',
      shiftHint: 'Shift+点击 可在两行之间切换范围。',
      enabledCount: '{{enabled}}/{{total}} 开启',
      selectAll: '全选',
      clearAll: '全部清除',
      categories: {
        general: { label: '常规', description: '扫描性能和高风险项目目标。' },
        package_managers: {
          label: '包管理器',
          description: 'Node、Python、Conda、bun、NuGet 和 Composer 的全局缓存（审阅级）。',
        },
        language_runtimes: {
          label: '语言运行时',
          description: '单个项目外的编译器和运行时缓存。',
        },
        ide_tooling: { label: 'IDE 与工具', description: '编辑器和 SDK 全局缓存。' },
      },
      options: {
        include_size: { label: '计算大小', description: '关闭以加快扫描 (CLI: --no-size)。' },
        include_python_venv: {
          label: '包含 Python venv',
          description: '检测到 Python 项目时的 venv / .venv（高风险）。',
        },
        check_npm_cache: { label: 'npm 缓存', description: '带 _cacache 的 npm 缓存目录。' },
        check_pnpm_store: { label: 'pnpm 存储', description: '全局存储和项目 `.pnpm-store` 文件夹。' },
        check_yarn_cache: { label: 'Yarn 缓存', description: 'Yarn Classic 或 Berry 全局缓存。' },
        check_pip_cache: { label: 'pip 缓存', description: 'pip 下载缓存。' },
        check_uv_cache: { label: 'uv 缓存', description: 'uv 包缓存。' },
        check_conda_pkgs_cache: { label: 'Conda pkgs 缓存', description: 'Conda/Miniconda 包缓存。' },
        check_bun_cache: { label: 'bun 缓存', description: '全局 bun 安装缓存。' },
        check_nuget_cache: { label: 'NuGet 全局包', description: 'NuGet 包存储。' },
        check_composer_cache: { label: 'Composer 缓存', description: 'PHP Composer 缓存。' },
        check_go_cache: { label: '全局 Go 缓存', description: '通过 go env 扫描 GOCACHE 和 GOMODCACHE。' },
        check_cargo_registry: { label: 'Cargo 注册表缓存', description: 'CARGO_HOME/registry。' },
        check_vcpkg_cache: { label: 'vcpkg 已安装树', description: 'VCPKG_ROOT/installed 端口。' },
        check_conan_cache: { label: 'Conan 包缓存', description: 'Conan 2 全局包缓存。' },
        check_ccache: { label: 'ccache', description: '编译器对象缓存。' },
        check_sccache: { label: 'sccache', description: '共享编译器缓存。' },
        check_bazel_disk_cache: { label: 'Bazel 磁盘缓存', description: 'BAZEL_DISK_CACHE 目录。' },
        check_jvm_global_cache: { label: '全局 JVM 缓存', description: '~/.m2/repository 和 ~/.gradle/caches。' },
        check_ide_global_cache: {
          label: 'IDE 全局缓存',
          description: 'Xcode DerivedData 及 JetBrains/Android Studio 缓存。',
        },
        smart_discovery_enabled: { label: '智能发现', description: '将声明性路径模式匹配到已注册类型。' },
      },
    },
    policyPack: {
      title: '策略包图库',
      description: '浏览随附示例、预览 JSON、查看替换差异，并将 .deco/disk-cleanup.json 应用到项目。',
      intro: '来自仓库图库的随附示例。选择一个预览 JSON，然后应用到项目文件夹。',
      loading: '正在加载图库…',
      browseCustom: '浏览自定义包…',
      opening: '正在打开…',
      previewTitle: '预览 — {{title}}',
      applyToProject: '应用到项目',
      noFolder: '未选择文件夹。',
      chooseFolder: '选择项目文件夹…',
      validationOk: '验证通过',
      incoming: '传入',
      current: '当前',
      replacePreview: '替换预览（顶层）',
      replaceWarning: '整个文件将被替换；如需请手动合并字段。',
      validationFailed: '验证失败。',
      applied: '已应用 — 写入',
      revealExplorer: '在资源管理器中显示',
      applying: '应用中…',
      apply: '应用策略包',
      customPack: '自定义包',
      defaultTitle: '策略包',
    },
    safety: {
      title: '安全',
      description: '清理如何释放空间。磁盘几乎满时使用删除。',
      deleteMode: '删除模式',
      deleteInPlace: '就地删除（推荐）— 立即释放空间，无副本',
      quarantineSameDrive: '同驱动器隔离 — 移至 .deco-quarantine，可恢复',
      deleteHint: '就地删除不存储备份。清理 C: 或磁盘几乎满时使用。',
      cleanupDiskMode: '清理磁盘模式',
      diskAuto: '自动 — 大批次保守',
      diskHdd: 'HDD / 顺序 — 一次一个文件夹',
      diskStandard: '标准 — 遵循扫描工作线程数',
      diskHint: 'HDD 模式一次删除一棵树。清理期间可暂停/恢复。',
      fastDelete: '依赖树快速删除（实验性）',
      fastDeleteDesc: '就地删除时，通过系统命令删除 node_modules、target 和构建文件夹。',
      quarantineStorage: '隔离存储',
      quarantineEnableHint: '通过上方选择“同驱动器隔离”启用。',
      quarantinePerDrive: '在每个源驱动器上 — {drive}\\.deco-quarantine（推荐）',
      quarantineCustom: '自定义文件夹 — 您选择路径',
      quarantinePlaceholder: '例如 E:\\DecoQuarantine',
      browse: '浏览…',
      systemDriveWarning: '此文件夹在系统 (C:) 驱动器上 — 隔离将占用 C: 空间。',
      advancedMode: '高级模式',
      advancedDesc: '启用硬删除和实验性分类器。',
      classifyThreshold: '分类并行阈值',
      classifyAria: '并行分类前的最小目标数',
      classifyHint: '当块至少有这么多目标时运行 Rayon 分类（默认 8）。',
    },
    presets: {
      cleanup: {
        first_scan: {
          label: '首次扫描',
          description: '保守安全、彻底遍历、全范围 — 在启用全局缓存前审计。',
        },
        monorepo_maintainer: {
          label: 'Monorepo 维护者',
          description: '平衡默认值及包管理器和注册表缓存加智能 IDE 模式。',
        },
        ci_agent: {
          label: 'CI 代理',
          description: '快速浅层遍历、驱动器根、编译器缓存。',
        },
      },
      scanStrategy: {
        thorough: { label: '彻底', description: '更深搜索、平衡并行 — 适合首次扫描或审计。' },
        balanced: { label: '平衡', description: '大多数机器和重复扫描的默认权衡。' },
        fast: { label: '快速', description: '较浅遍历、8 个并行工作线程 — 适合 SSD/NVMe。' },
        background: { label: '后台', description: '温和磁盘使用 — 2 个工作线程、浅遍历 (HDD)。' },
      },
      scanScope: {
        all: '全部 — 开发文件夹 + 驱动器（推荐）',
        projects: '项目 — 仅配置文件文件夹',
        drives: '驱动器 — 仅分区根',
      },
      safetyProfile: {
        safe: '安全（保守）',
        balanced: '平衡',
        aggressive: '激进（最大空间）',
      },
      concurrency: {
        auto: '自动 — 6 个并行工作线程（推荐）',
        low: '低 — 2 个工作线程 (HDD / 后台)',
        high: '高 — 8 个工作线程（快速 SSD）',
      },
      cleanupDiskMode: {
        auto: '自动 — 大批次保守',
        hdd: 'HDD / 顺序 — 一次一个文件夹',
        standard: '标准 — 遵循扫描工作线程数',
      },
    },
  },
});

applyLocaleOverrides(es, {
  header: {
    dashboard: {
      default: 'Escanear, revisar candidatos y recuperar espacio en disco.',
      searchStopped:
        'Búsqueda de directorios detenida. Calculando tamaños — haga clic en Detener análisis para omitir el resto.',
    },
    quarantine: 'Restaurar o purgar permanentemente las carpetas retenidas.',
    history: 'Revisar escaneos anteriores y reutilizar configuraciones.',
    settings: 'Configurar objetivos de escaneo, seguridad y opciones de descubrimiento.',
  },
  dashboard: {
    actions: {
      freeUpSpace: 'Liberar espacio',
      scanNow: 'Escanear ahora',
      quickUpdate: 'Actualización rápida',
      recommended: 'Recomendado',
      quickUpdateTitleRecommended:
        'Recomendado para escaneos repetidos — reutiliza inventario; mucho más rápido en HDD si las rutas no cambian.',
      quickUpdateTitleDefault:
        'Reutiliza clasificación/tamaño en rutas sin cambios. Ejecute un escaneo completo tras cambiar el perfil u opciones de descubrimiento.',
      cleanSelected: 'Limpiar selección…',
    },
    empty: {
      title: '¿Necesita más espacio en disco?',
      description:
        'Ejecute el flujo guiado para escanear proyectos, revisar objetivos seguros y poner en cuarentena — nada se elimina permanentemente hasta purgar la cuarentena.',
      cta: 'Iniciar limpieza guiada',
    },
    stats: {
      safe: 'Seguro',
      review: 'Revisar',
      blocked: 'Bloqueado',
      totalReclaimable: 'Total recuperable',
      noScanYet: 'Sin escaneo aún',
      itemsDiscovered: '{{count}} elementos descubiertos',
    },
    scanTargets: {
      title: 'Objetivos de escaneo',
      ready: 'Elija unidades o carpetas, luego Escanear ahora.',
      notReady: 'Seleccione al menos una unidad o carpeta personalizada antes de escanear.',
      profile: 'Perfil',
      strategy: 'Estrategia',
      notReadyBadge: 'No listo',
      profiles: { safe: 'Seguro (conservador)', balanced: 'Equilibrado', aggressive: 'Agresivo' },
    },
    scanMode: { partition: 'Particiones de disco', custom: 'Directorios personalizados' },
    candidates: {
      searchPlaceholder: 'Buscar ruta o tipo…',
      selected: '{{count}} seleccionados',
      showingFiltered: 'Mostrando {{filtered}} de {{total}}',
      candidateCount: '{{count}} candidatos',
      projectCount: '{{count}} proyectos',
      clickHeadersToSort: 'Clic en encabezados para ordenar',
      groupedByProject: 'Agrupado por proyecto',
      flatList: 'Lista plana',
      groupHint: 'Recomendado para escaneos grandes — expanda un proyecto para ver cada artefacto.',
      searchStoppedBanner:
        'La búsqueda de directorios se detuvo. Aún se calculan tamaños — use Detener análisis en el encabezado.',
      stopAnalysis: 'Detener análisis',
      noCandidates: 'No se encontraron candidatos.',
      table: { risk: 'Riesgo', kind: 'Tipo', path: 'Ruta', stale: 'Antigüedad', size: 'Tamaño' },
      units: { projects: 'proyectos', items: 'elementos' },
    },
    filters: {
      title: 'Filtros',
      clearAll: 'Borrar todo',
      risk: 'Riesgo',
      allRisks: 'Todos los riesgos',
      allKinds: 'Todos los tipos',
    },
    detail: {
      title: 'Detalle del candidato',
      path: 'Ruta',
      showInExplorer: 'Mostrar en el Explorador de archivos',
      reason: 'Motivo',
      project: 'Proyecto',
      dormancy: 'Inactividad',
      regenerate: 'Regenerar',
      size: 'Tamaño',
      reasonCodes: 'Códigos de motivo',
      selectPrompt: 'Seleccione un elemento para ver sus metadatos.',
      gitLoading: 'Cargando pista de último commit git…',
      gitNone: 'Sin historial git para esta ruta (o git no disponible).',
    },
    planner: {
      title: 'Planificador de espacio libre',
      noScan:
        'Ejecute un escaneo para ver espacio recuperable, luego establezca un objetivo y seleccione candidatos automáticamente.',
      reclaimable: 'Recuperable del escaneo',
      safeLegend: 'Seguro',
      reviewLegend: 'Revisar',
      targetGb: 'Objetivo: {{gb}} GB',
      targetLabel: 'Objetivo a liberar (GB)',
      targetAria: 'Objetivo a liberar en gigabytes',
      sliderAria: 'Control deslizante de gigabytes objetivo',
      planSafe: 'Plan seguro',
      planReview: 'Incl. revisar',
      previewCleanup: 'Vista previa de limpieza',
      runScanFirst: 'Ejecute un escaneo primero.',
      selectedSummary: 'Seleccionados {{count}} carpetas (~{{achievable}}). Objetivo era {{target}}.',
      targetNotReached:
        'No se alcanzó ese objetivo con los resultados actuales. Pruebe un objetivo menor o incluya elementos de revisión.',
    },
    lastScan: {
      title: 'Último escaneo',
      history: 'Historial',
      reclaimable: 'Recuperable',
      candidates: 'Candidatos',
      profile: 'Perfil',
      mode: 'Modo',
      reuse: 'Reutilizar escaneo',
      modes: { partition: 'Particiones', custom: 'Carpetas personalizadas' },
    },
    scanScope: { projects: 'carpetas de proyecto', drives: 'unidades locales', all: 'proyectos + unidades' },
  },
  settings: {
    loading: 'Cargando ajustes…',
    title: 'Configuración global',
    description:
      'Perfil de seguridad, opciones de descubrimiento y comportamiento avanzado de escaneo. Configure unidades y carpetas en el Panel.',
    unsaved: 'Cambios sin guardar',
    language: {
      title: 'Idioma',
      description: 'Idioma de la interfaz. Se guarda en este equipo.',
      field: 'Idioma de visualización',
    },
    updates: {
      title: 'Actualizaciones',
      description: 'Las versiones de escritorio se distribuyen vía GitHub Releases (Windows MSI / NSIS).',
      checkTitle: 'Buscar actualizaciones',
      checkDescription:
        'Compara esta instalación con la última versión en GitHub Releases · detectado {{platform}}.',
      checkAgain: 'Comprobar de nuevo',
      checking: 'Comprobando…',
      installed: 'Instalado',
      contacting: 'Contactando GitHub…',
      latest: 'Tiene la última versión ({{tag}}).',
      checkedAt: '· comprobado {{time}}',
      updateAvailable: 'Actualización disponible: {{tag}} (tiene v{{version}})',
      savedTo: 'Guardado en',
      installFinish: ' — siga el instalador y reinicie Deco.',
      extractManual: ' — extraiga o instale manualmente y reinicie Deco.',
      releaseNotes: 'Notas de la versión',
      downloadInstall: 'Descargar e instalar',
      downloading: 'Descargando…',
      install: 'Instalar',
      browser: 'Navegador',
    },
    scanBehavior: {
      title: 'Comportamiento de escaneo',
      descriptionPartition:
        'Elija un perfil de limpieza, luego ajuste estrategia y umbrales. El alcance aplica al sugerir raíces en unidades vacías.',
      descriptionCustom:
        'Elija un perfil de limpieza, luego ajuste estrategia y umbrales. El modo de carpetas personalizadas ignora el diseño de particiones.',
      cleanupProfile: 'Perfil de limpieza',
      scanStrategy: 'Estrategia de escaneo',
      customMismatchProfile:
        'El perfil de seguridad, indicadores o alcance ya no coinciden con un preset — ajuste abajo o elija un perfil.',
      customMismatchStrategy:
        'Profundidad, paralelismo o actualización rápida ya no coinciden — ajuste abajo o elija un preset.',
      profileBundleHint: 'Agrupa alcance, perfil de seguridad, descubrimiento y estrategia.',
      strategyBundleHint: 'Mapea a profundidad de búsqueda, paralelismo de tamaño y actualización rápida.',
      scanScope: 'Alcance de escaneo',
      safetyProfile: 'Perfil de seguridad',
      staleThreshold: 'Umbral de antigüedad (días)',
      staleAria: 'Umbral de antigüedad en días',
      performance: {
        title: 'Ajuste de rendimiento',
        hint: 'Ajustar esto puede cambiar la estrategia a Personalizado.',
        maxDepth: 'Profundidad máxima de búsqueda',
        maxDepthAria: 'Profundidad máxima de búsqueda',
        workers: 'Workers paralelos (descubrir / tamaño / eliminar)',
        gitDormancy: 'Pista de inactividad git (detalle)',
        gitDormancyDesc:
          'Al seleccionar un candidato, ejecuta git log del último commit. Opcional; no afecta la velocidad del escaneo.',
        quickUpdate: 'Inventario incremental (actualización rápida)',
        quickUpdateDesc:
          'Reutiliza clasificación y tamaño en rutas sin cambios. Ejecute escaneo completo tras cambiar perfil u opciones.',
        fastSize: 'Estimación rápida de tamaño en árboles de dependencias',
        fastSizeDesc:
          'Muestrea paquetes de primer nivel en node_modules, target, etc., en lugar de recorrer cada archivo.',
      },
    },
    discovery: {
      title: 'Descubrimiento',
      description: 'Objetivos de artefactos opcionales durante escaneos.',
      shiftHint: 'Mayús+clic para alternar un rango entre dos filas.',
      enabledCount: '{{enabled}}/{{total}} activos',
      selectAll: 'Seleccionar todo',
      clearAll: 'Borrar todo',
      categories: {
        general: { label: 'General', description: 'Rendimiento de escaneo y objetivos de proyecto de alto riesgo.' },
        package_managers: {
          label: 'Gestores de paquetes',
          description: 'Cachés globales de Node, Python, Conda, bun, NuGet y Composer (nivel revisar).',
        },
        language_runtimes: {
          label: 'Runtimes de lenguaje',
          description: 'Cachés de compilador y runtime fuera de proyectos individuales.',
        },
        ide_tooling: { label: 'IDE y herramientas', description: 'Cachés globales de editor y SDK.' },
      },
      options: {
        include_size: { label: 'Calcular tamaños', description: 'Desactivar para escaneo más rápido (CLI: --no-size).' },
        include_python_venv: {
          label: 'Incluir venv de Python',
          description: 'venv / .venv cuando se detecta proyecto Python (alto riesgo).',
        },
        check_npm_cache: { label: 'caché npm', description: 'Directorio de caché npm con _cacache.' },
        check_pnpm_store: { label: 'almacén pnpm', description: 'Almacén global y carpetas `.pnpm-store`.' },
        check_yarn_cache: { label: 'caché Yarn', description: 'Caché global Yarn Classic o Berry.' },
        check_pip_cache: { label: 'caché pip', description: 'Caché de descarga pip.' },
        check_uv_cache: { label: 'caché uv', description: 'Caché de paquetes uv.' },
        check_conda_pkgs_cache: { label: 'caché Conda pkgs', description: 'Caché de paquetes Conda/Miniconda.' },
        check_bun_cache: { label: 'caché bun', description: 'Caché global de instalación bun.' },
        check_nuget_cache: { label: 'paquetes globales NuGet', description: 'Almacén de paquetes NuGet.' },
        check_composer_cache: { label: 'caché Composer', description: 'Caché PHP Composer.' },
        check_go_cache: { label: 'caché global Go', description: 'Escaneo opcional de GOCACHE y GOMODCACHE.' },
        check_cargo_registry: { label: 'caché del registro Cargo', description: 'CARGO_HOME/registry con crates descargados.' },
        check_vcpkg_cache: { label: 'árbol instalado vcpkg', description: 'Puertos VCPKG_ROOT/installed.' },
        check_conan_cache: { label: 'caché de paquetes Conan', description: 'Caché global Conan 2.' },
        check_ccache: { label: 'ccache', description: 'Caché de objetos del compilador.' },
        check_sccache: { label: 'sccache', description: 'Caché compartida del compilador.' },
        check_bazel_disk_cache: { label: 'caché en disco Bazel', description: 'Cuando BAZEL_DISK_CACHE apunta a un directorio cas/ac.' },
        check_jvm_global_cache: { label: 'cachés JVM globales', description: '~/.m2/repository y ~/.gradle/caches.' },
        check_ide_global_cache: { label: 'cachés globales IDE', description: 'Xcode DerivedData y cachés JetBrains/Android Studio.' },
        smart_discovery_enabled: {
          label: 'Descubrimiento inteligente',
          description: 'Coincide patrones de ruta declarativos con tipos registrados.',
        },
      },
    },
    policyPack: {
      title: 'Galería de paquetes de políticas',
      description:
        'Explore ejemplos incluidos, previsualice JSON, vea diff de reemplazo y aplique .deco/disk-cleanup.json a un proyecto.',
      intro:
        'Ejemplos incluidos de la galería del repositorio. Seleccione uno para previsualizar JSON y aplicar a una carpeta de proyecto.',
      loading: 'Cargando galería…',
      browseCustom: 'Examinar paquete personalizado…',
      opening: 'Abriendo…',
      previewTitle: 'Vista previa — {{title}}',
      applyToProject: 'Aplicar al proyecto',
      noFolder: 'Ninguna carpeta seleccionada.',
      chooseFolder: 'Elegir carpeta de proyecto…',
      validationOk: 'Validación correcta',
      incoming: 'Entrante',
      current: 'Actual',
      replacePreview: 'Vista previa de reemplazo (nivel superior)',
      replaceWarning: 'Se reemplazará el archivo completo; fusione campos manualmente si es necesario.',
      validationFailed: 'Validación fallida.',
      applied: 'Aplicado — escrito',
      revealExplorer: 'Mostrar en el Explorador',
      applying: 'Aplicando…',
      apply: 'Aplicar paquete de políticas',
      customPack: 'Paquete personalizado',
      defaultTitle: 'Paquete de políticas',
    },
    safety: {
      title: 'Seguridad',
      description: 'Cómo la limpieza libera espacio. Use Eliminar cuando la unidad esté casi llena.',
      deleteMode: 'Modo de eliminación',
      deleteInPlace: 'Eliminar in situ (recomendado) — libera espacio de inmediato',
      quarantineSameDrive: 'Cuarentena en la misma unidad — mueve a .deco-quarantine, restaurable',
      deleteHint: 'Eliminar in situ no guarda copias. Úselo al limpiar C: o cuando el disco esté casi lleno.',
      cleanupDiskMode: 'Modo de disco de limpieza',
      diskAuto: 'Auto — conservador en lotes grandes',
      diskHdd: 'HDD / secuencial — una carpeta a la vez',
      diskStandard: 'Estándar — sigue workers de escaneo',
      diskHint: 'Modo HDD elimina un árbol a la vez. Pausa/reanudación disponible durante la limpieza.',
      fastDelete: 'Eliminación rápida de árboles de dependencias (experimental)',
      fastDeleteDesc:
        'Al eliminar in situ, quita node_modules, target y carpetas de compilación vía comandos del sistema.',
      quarantineStorage: 'Almacenamiento en cuarentena',
      quarantineEnableHint: 'Active eligiendo “Cuarentena en la misma unidad” arriba.',
      quarantinePerDrive: 'En cada unidad de origen — {drive}\\.deco-quarantine (recomendado)',
      quarantineCustom: 'Carpeta personalizada — usted elige la ruta',
      quarantinePlaceholder: 'p. ej. E:\\DecoQuarantine',
      browse: 'Examinar…',
      systemDriveWarning: 'Esta carpeta está en la unidad del sistema (C:) — la cuarentena usará espacio en C:.',
      advancedMode: 'Modo avanzado',
      advancedDesc: 'Habilita eliminación forzada y clasificadores experimentales.',
      classifyThreshold: 'Umbral paralelo de clasificación',
      classifyAria: 'Mínimo de objetivos antes de clasificar en paralelo',
      classifyHint:
        'La clasificación Rayon corre cuando un bloque tiene al menos este número de objetivos (predeterminado 8).',
    },
    presets: {
      cleanup: {
        first_scan: {
          label: 'Primer escaneo',
          description:
            'Seguridad conservadora, recorrido exhaustivo, alcance total — audite antes de habilitar cachés globales.',
        },
        monorepo_maintainer: {
          label: 'Mantenedor de monorepo',
          description:
            'Valores equilibrados con cachés de gestores y registros más patrones IDE inteligentes.',
        },
        ci_agent: {
          label: 'Agente CI',
          description: 'Paso rápido superficial, raíces de unidad, cachés de compilador.',
        },
      },
      scanStrategy: {
        thorough: {
          label: 'Exhaustivo',
          description: 'Búsqueda más profunda, paralelismo equilibrado — ideal para primer escaneo o auditoría.',
        },
        balanced: {
          label: 'Equilibrado',
          description: 'Compromiso predeterminado para la mayoría de máquinas y escaneos repetidos.',
        },
        fast: {
          label: 'Rápido',
          description: 'Recorrido más superficial, 8 workers — amigable con SSD/NVMe.',
        },
        background: {
          label: 'En segundo plano',
          description: 'Uso suave del disco — 2 workers, recorrido superficial (HDD).',
        },
      },
      scanScope: {
        all: 'Todo — carpetas de desarrollo + unidades (recomendado)',
        projects: 'Proyectos — solo carpetas de perfil',
        drives: 'Unidades — solo raíces de partición',
      },
      safetyProfile: {
        safe: 'Seguro (conservador)',
        balanced: 'Equilibrado',
        aggressive: 'Agresivo (máximo espacio)',
      },
      concurrency: {
        auto: 'Auto — 6 workers paralelos (recomendado)',
        low: 'Bajo — 2 workers (HDD / segundo plano)',
        high: 'Alto — 8 workers (SSD rápido)',
      },
      cleanupDiskMode: {
        auto: 'Auto — conservador en lotes grandes',
        hdd: 'HDD / secuencial — una carpeta a la vez',
        standard: 'Estándar — sigue workers de escaneo',
      },
    },
  },
});

for (const [code, data] of [
  ['en', en],
  ['cn', cn],
  ['es', es],
]) {
  writeFileSync(join(dir, `${code}.json`), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

console.log('Wrote en.json, cn.json, es.json');
