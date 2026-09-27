// lib/types.ts — shapes shared between API routes and client components.
import type { SessionData } from "./data";
import type { Alert, Stats, StudentTimeline } from "./metrics";

/** Response body of GET /api/sessions/[id]/dashboard. */
export type DashboardResponse = {
  session: SessionData["session"];
  elapsedMin: number;
  stats: Stats;
  alerts: Alert[];
  timeline: StudentTimeline[];
  generatedAt: string;
};
