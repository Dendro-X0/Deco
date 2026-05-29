/** Wire shapes from `migrate_tool_dir_plan` / `migrate_tool_dir_run` (Rust DTOs). */

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
  legs?: ToolMigrationPlanLeg[];
  running_processes?: string[];
};

export type ToolMigrationResultLeg = {
  leg: string;
  ok: boolean;
  source: string;
  dest: string;
  backup_path?: string;
  skipped?: boolean;
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
};
