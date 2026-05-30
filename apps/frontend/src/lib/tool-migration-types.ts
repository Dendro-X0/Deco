/** Wire shapes from `migrate_tool_dir_plan` / `migrate_tool_dir_run` (Rust DTOs). */

export type ToolMigrationBackupEntry = {
  leg?: string;
  path: string;
  bytes?: number;
  file_count?: number;
};

export type ToolMigrationPlanLeg = {
  leg: string;
  source: string;
  dest: string;
  bytes?: number;
  file_count?: number;
  skipped: boolean;
  skip_reason?: string;
};

export type ToolMigrationPlan = {
  ok: boolean;
  tool: string;
  source: string;
  dest: string;
  bytes?: number;
  file_count?: number;
  warnings: string[];
  errors: string[];
  plan_only: boolean;
  already_complete?: boolean;
  custom_mode?: boolean;
  legs?: ToolMigrationPlanLeg[];
  running_processes?: string[];
  pending_backups?: ToolMigrationBackupEntry[];
};

export type ToolMigrationResultLeg = {
  leg: string;
  ok: boolean;
  source: string;
  dest: string;
  backup_path?: string;
  skipped?: boolean;
};

export type ManagedMigrationEntry = {
  id: string;
  tool: string;
  source_path: string;
  dest_path: string;
  leg?: string;
  migrated_at: string;
  audit_log_path?: string;
  discovered: boolean;
};

export type ToolMigrationResult = {
  ok: boolean;
  tool: string;
  source: string;
  dest: string;
  audit_log_path?: string;
  backup_path?: string;
  warnings: string[];
  errors: string[];
  legs?: ToolMigrationResultLeg[];
  pending_backups?: ToolMigrationBackupEntry[];
};
