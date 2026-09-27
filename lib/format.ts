// lib/format.ts — display helpers. Timestamps are shown in UTC so server and every viewer agree.
const utcFmt = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function formatUtc(iso: string): string {
  return `${utcFmt.format(new Date(iso))} UTC`;
}
