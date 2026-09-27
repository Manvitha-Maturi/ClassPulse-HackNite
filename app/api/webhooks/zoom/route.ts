// app/api/webhooks/zoom/route.ts — Zoom meeting webhooks → lib/ingest.ts (same path as the simulator).
// Verifies Zoom's HMAC signature on the raw body, answers the URL-validation challenge, and maps
// participant_joined/left to connection events. Unknown participants are logged and ignored — the
// roster is never created or changed from webhook data, and nothing but ids/timestamps is stored.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestConnection } from "@/lib/ingest";
import { parseParticipantEvent, urlValidationResponse, verifyZoomSignature } from "@/lib/zoom";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
  if (!secret) {
    console.error("Zoom webhook: ZOOM_WEBHOOK_SECRET_TOKEN is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  // Raw text first: the signature covers the exact bytes Zoom sent.
  const rawBody = await req.text();
  let body: { event?: string; payload?: { plainToken?: unknown } };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.event === "endpoint.url_validation") {
    const plainToken = body.payload?.plainToken;
    if (typeof plainToken !== "string" || !plainToken) {
      return NextResponse.json({ error: "Missing plainToken" }, { status: 400 });
    }
    return NextResponse.json(urlValidationResponse(plainToken, secret));
  }

  const signed = verifyZoomSignature({
    secret,
    signature: req.headers.get("x-zm-signature"),
    timestamp: req.headers.get("x-zm-request-timestamp"),
    rawBody,
  });
  if (!signed) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  const event = parseParticipantEvent(body);
  // Other event types are acknowledged so Zoom doesn't retry them.
  if (!event) return NextResponse.json({ ok: true, ignored: body.event ?? "unknown" });

  try {
    const admin = createAdminClient();
    const { data: session, error: sessErr } = await admin
      .from("sessions")
      .select("id, course_code")
      .eq("external_meeting_id", event.meetingId)
      .eq("status", "live")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sessErr) throw sessErr;
    if (!session) {
      console.warn(`Zoom webhook: no live session for meeting ${event.meetingId}; ignored`);
      return NextResponse.json({ ok: true, ignored: "no live session" });
    }

    const studentId = await matchStudent(admin, session.course_code, event.participantIds, event.displayName);
    if (!studentId) {
      // Ids only in logs: no names or emails.
      console.warn(
        `Zoom webhook: unknown participant [${event.participantIds.join(", ") || "no id"}] in meeting ${event.meetingId}; ignored`,
      );
      return NextResponse.json({ ok: true, ignored: "unknown participant" });
    }

    // Retries are safe: buildTimeline ignores duplicate joins and orphan leaves.
    await ingestConnection({
      sessionId: session.id,
      studentId,
      type: event.type,
      occurredAt: event.occurredAt,
      source: "zoom",
    });
    return NextResponse.json({ ok: true, recorded: event.type });
  } catch (err) {
    console.error("Zoom webhook failed:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

/** external_participant_id first, then an exact display-name match within the session's course. */
async function matchStudent(
  admin: ReturnType<typeof createAdminClient>,
  courseCode: string,
  participantIds: string[],
  displayName: string | null,
): Promise<string | null> {
  if (participantIds.length) {
    const { data, error } = await admin
      .from("students")
      .select("id")
      .eq("course_code", courseCode)
      .in("external_participant_id", participantIds)
      .limit(1);
    if (error) throw error;
    if (data?.length) return data[0].id as string;
  }
  if (displayName) {
    const { data, error } = await admin
      .from("students")
      .select("id")
      .eq("course_code", courseCode)
      .eq("display_name", displayName)
      .limit(1);
    if (error) throw error;
    if (data?.length) return data[0].id as string;
  }
  return null;
}
