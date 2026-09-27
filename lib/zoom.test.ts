// lib/zoom.test.ts — Zoom webhook HMAC validation. Expected hashes were cross-checked with
// `openssl dgst -sha256 -hmac`, so these tests don't just compare node:crypto against itself.
import { describe, expect, it } from "vitest";
import { parseParticipantEvent, urlValidationResponse, verifyZoomSignature } from "./zoom";

const SECRET = "test-secret-token";
const TS = "1790000000";
const BODY = JSON.stringify({ event: "meeting.participant_left", payload: { object: { id: "123" } } });
const SIGNATURE = "v0=b3c1e2e2419d259c86c6020ec61b08b227e3b583b0d21ddb9ecff8baec357b28";
const NOW = Number(TS) + 30;

describe("endpoint.url_validation", () => {
  it("returns the plainToken and its HMAC-SHA256 hex as encryptedToken", () => {
    expect(urlValidationResponse("qgg8vlvZRS6UYooatFL8Aw", SECRET)).toEqual({
      plainToken: "qgg8vlvZRS6UYooatFL8Aw",
      encryptedToken: "9c8ad56737c19db2904b301c0781e86857e999f39f07727668cf62a5e7e298c8",
    });
  });
});

describe("x-zm-signature verification", () => {
  const base = { secret: SECRET, signature: SIGNATURE, timestamp: TS, rawBody: BODY, nowSec: NOW };

  it("accepts a correctly signed request", () => {
    expect(verifyZoomSignature(base)).toBe(true);
  });

  it("rejects a tampered body", () => {
    expect(verifyZoomSignature({ ...base, rawBody: BODY.replace("123", "124") })).toBe(false);
  });

  it("rejects the wrong secret", () => {
    expect(verifyZoomSignature({ ...base, secret: "other-secret" })).toBe(false);
  });

  it("rejects a different timestamp than the one signed", () => {
    expect(verifyZoomSignature({ ...base, timestamp: String(Number(TS) + 1) })).toBe(false);
  });

  it("rejects missing or malformed headers without throwing", () => {
    expect(verifyZoomSignature({ ...base, signature: null })).toBe(false);
    expect(verifyZoomSignature({ ...base, timestamp: null })).toBe(false);
    expect(verifyZoomSignature({ ...base, signature: "v0=short" })).toBe(false);
    expect(verifyZoomSignature({ ...base, timestamp: "not-a-number" })).toBe(false);
  });

  it("rejects replays older than 5 minutes", () => {
    expect(verifyZoomSignature({ ...base, nowSec: Number(TS) + 5 * 60 + 1 })).toBe(false);
  });
});

describe("participant event parsing", () => {
  it("maps participant_joined to a join with ids, name and join_time", () => {
    expect(
      parseParticipantEvent({
        event: "meeting.participant_joined",
        payload: {
          object: {
            id: 987654321,
            participant: { participant_user_id: "pu-1", id: "p-1", user_name: " Priya S. ", join_time: "2026-10-05T18:00:12Z", email: "x@y.z" },
          },
        },
      }),
    ).toEqual({
      type: "join",
      meetingId: "987654321",
      participantIds: ["pu-1", "p-1"],
      displayName: "Priya S.",
      occurredAt: "2026-10-05T18:00:12.000Z",
    });
  });

  it("ignores other event types", () => {
    expect(parseParticipantEvent({ event: "meeting.started", payload: { object: { id: 1 } } })).toBeNull();
  });
});
