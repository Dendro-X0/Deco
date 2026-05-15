export type ByteCount = number;

export type CleanupMode = 'dry-run' | 'delete';

export type CleanupProfile = 'safe' | 'balanced' | 'aggressive';

export type DeleteMode = 'quarantine' | 'recycle-bin' | 'hard-delete';

export type CleanupAction = 'scan' | 'restore' | 'purge-quarantine';

export type TargetDirKind =
  | 'node_modules'
  | 'build-artifact'
  | 'rust-artifact'
  | 'go-artifact'
  | 'go-global-cache'
  | 'playwright-artifact'
  | 'unknown-artifact'
  | 'python-artifact'
  | 'python-venv'
  | 'jvm-artifact'
  | 'jvm-global-cache'
  | 'dotnet-artifact'
  | 'ide-global-cache';

export type SafetyClass = 'project_artifact' | 'global_cache' | 'app_runtime' | 'system' | 'unknown';

export type RiskLevel = 'safe' | 'review' | 'blocked';

export type ReasonCode =
  | 'PROTECTED_SYSTEM_PATH'
  | 'ELECTRON_RUNTIME_PATH'
  | 'IDE_RUNTIME_PATH'
  | 'CUSTOM_PROTECTED_PATH'
  | 'ALLOWLIST_DOWNGRADE'
  | 'PROJECT_MARKERS_PRESENT'
  | 'PROJECT_MARKERS_MISSING'
  | 'NODE_MODULES_NOT_STALE'
  | 'NODE_MODULES_STALE'
  | 'NODE_MODULES_OUTSIDE_PROJECT'
  | 'GLOBAL_CACHE_TARGET'
  | 'GLOBAL_CACHE_REQUIRES_OPT_IN'
  | 'PYTHON_VENV_HIGH_RISK'
  | 'PYTHON_VENV_REQUIRES_OPT_IN'
  | 'LOW_CONFIDENCE_ARTIFACT'
  | 'UNKNOWN_ARTIFACT';

export type CleanupCandidate = {
  readonly kind: TargetDirKind;
  readonly absPath: string;
  readonly safetyClass: SafetyClass;
  readonly risk: RiskLevel;
  readonly reasonCodes: readonly ReasonCode[];
  readonly projectRoot?: string;
  readonly staleDays?: number;
  mtimeMs?: number;
  size?: ByteCount;
};

export type TotalsByRisk = Record<RiskLevel, { count: number; bytes: ByteCount }>;

export type TotalsByKind = Record<string, { count: number; bytes: ByteCount }>;

export type ScanReportV2 = {
  readonly candidates: readonly CleanupCandidate[];
  readonly totalsByRisk: TotalsByRisk;
  readonly totalsByKind: TotalsByKind;
  readonly totalBytes: ByteCount;
  readonly errors: readonly string[];
  readonly scannedDirs: number;
};

export type ProgressPhase = 'discover' | 'classify' | 'size';

export type ProgressUpdate = {
  readonly phase?: ProgressPhase;
  readonly scannedDirs: number;
  readonly foundTargets: number;
  /** During size phase: how many candidates have been sized (best-effort). */
  readonly sizedCandidates?: number;
};

export type ProgressListener = (update: ProgressUpdate) => void;

export type CliOptions = {
  readonly action: CleanupAction;
  readonly roots: readonly string[];
  readonly maxDepth: number;
  readonly mode: CleanupMode;
  readonly yes: boolean;
  readonly interactive: boolean;
  readonly includeNodeModules: boolean;
  readonly includeBuildArtifacts: boolean;
  readonly includeRustArtifacts: boolean;
  readonly includePlaywrightArtifacts: boolean;
  readonly includeGoArtifacts: boolean;
  readonly includeSize: boolean;
  readonly checkGoCache: boolean;
  readonly includePythonArtifacts: boolean;
  readonly includePythonVenv: boolean;
  readonly includeJvmArtifacts: boolean;
  readonly checkJvmGlobalCache: boolean;
  readonly includeDotnetArtifacts: boolean;
  readonly checkIdeGlobalCache: boolean;
  readonly excludeAbsPathContains: readonly string[];
  readonly profile: CleanupProfile;
  readonly deleteMode: DeleteMode;
  readonly staleDays: number;
  readonly includeReview: boolean;
  readonly json: boolean;
  readonly showBlocked: boolean;
  readonly restoreId?: string;
  readonly purgeQuarantine: boolean;
  readonly quarantineRoot?: string;
  readonly quarantineRetentionDays: number;
  readonly extraProtectedPathContains: readonly string[];
  readonly allowPathContains: readonly string[];
  readonly additionalDirNames: {
    readonly buildArtifacts: readonly string[];
    readonly rustArtifacts: readonly string[];
    readonly goArtifacts: readonly string[];
    readonly playwrightArtifacts: readonly string[];
  };
  readonly silent?: boolean;
};