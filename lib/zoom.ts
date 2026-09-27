// lib/zoom.ts — pure helpers for Zoom webhooks: HMAC signing/verification and event parsing.
// No I/O and no server-only imports, so it is unit-testable; the route handler does the database work.
// Privacy: only participant ids, the display name (for roster matching) and a timestamp are read —
// emails and any other payload fields are ignored and never stored.
import { createHmac, timingSafeEqual } from "node:crypto";

/** Max age of a signed request before it's treated as a replay. */
export const MAX_REQUEST_AGE_SEC = 5 * 60;

export function zoomHmac(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("hex");
}

/** Response body for Zoom's "endpoint.url_validation" challenge. */
export function urlValidationResponse(plainToken: string, secret: string) {
  return { plainToken, encryptedToken: zoomHmac(secret, plainToken) };
}

/**
 * Verifies x-zm-signature = "v0=" + HMAC-SHA256(secret, `v0:${x-zm-request-timestamp}:${rawBody}`),
 * with a timing-safe compare and a replay window on the timestamp.
 */
export function verifyZoomSignature(opts: {
  secret: string;
  signature: string | null;
  timestamp: string | null;
  rawBody: string;
  nowSec?: number;
}): boolean {
  const { secret, signature, timestamp, rawBody, nowSec = Math.floor(Date.now() / 1000) } = opts;
  if (!signature || !timestamp || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(nowSec - Number(timestamp)) > MAX_REQUEST_AGE_SEC) return false;

  const expected = Buffer.from(`v0=${zoomHmac(secret, `v0:${timestamp}:${rawBody}`)}`);
  const actual = Buffer.from(signature);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export type ParticipantEvent = {
  type: "join" | "leave";
  meetingId: string;
  /** Candidate platform ids to match students.external_participant_id against, most specific first. */
  participantIds: string[];
  /** Fallback roster match within the course; never stored. */
  displayName: string | null;
  occurredAt: string; // ISO UTC
};

type ZoomParticipantBody = {
  event?: string;
  event_ts?: number;
  payload?: {
    object?: {
      id?: string | number;
      participant?: {
        participant_user_id?: string;
        user_id?: string;
        id?: string;
        user_name?: string;
        join_time?: string;
        leave_time?: string;
      };
    };
  };
};

const EVENT_TYPES: Record<string, ParticipantEvent["type"]> = {
  "meeting.participant_joined": "join",
  "meeting.participant_left": "leave",
};

/** Maps a meeting.participant_joined / participant_left body to a connection event; null for anything else. */
export function parseParticipantEvent(body: unknown): ParticipantEvent | null {
  const b = body as ZoomParticipantBody;
  const type = b?.event ? EVENT_TYPES[b.event] : undefined;
  const object = b?.payload?.object;
  const p = object?.participant;
  if (!type || object?.id === undefined || !p) return null;

  const rawTime = type === "join" ? p.join_time : p.leave_time;
  const time = rawTime ? Date.parse(rawTime) : typeof b.event_ts === "number" ? b.event_ts : NaN;
  if (Number.isNaN(time)) return null;

  const participantIds = [p.participant_user_id, p.id, p.user_id].filter(
    (x, i, all): x is string => typeof x === "string" && x.length > 0 && all.indexOf(x) === i,
  );

  return {
    type,
    meetingId: String(object.id),
    participantIds,
    displayName: p.user_name?.trim() || null,
    occurredAt: new Date(time).toISOString(),
  };
}
