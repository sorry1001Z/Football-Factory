export type OperationalRunStatus =
  | "running"
  | "draft_creating"
  | "held_for_content"
  | "recovery_queued"
  | "success"
  | "failed"
  | "waiting_approval"
  | "rejected";

const TRANSITIONS: Record<OperationalRunStatus, readonly OperationalRunStatus[]> = {
  running: ["running", "draft_creating", "held_for_content", "failed", "waiting_approval", "success"],
  draft_creating: ["waiting_approval", "failed"],
  held_for_content: ["recovery_queued"],
  recovery_queued: ["running", "failed"],
  failed: ["recovery_queued"],
  waiting_approval: ["success", "rejected"],
  success: [],
  rejected: [],
};

export function canTransitionRun(from: string, to: string): boolean {
  if (!(from in TRANSITIONS) || !(to in TRANSITIONS)) return false;
  return TRANSITIONS[from as OperationalRunStatus].includes(to as OperationalRunStatus);
}

export function isTerminalRunStatus(status: string): boolean {
  return status === "success" || status === "rejected";
}
