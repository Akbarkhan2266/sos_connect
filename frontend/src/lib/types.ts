export type SosStatus = "open" | "matched" | "accepted" | "resolved" | "cancelled" | "volunteer_not_found";
export type Severity = "pending" | "high" | "medium" | "low";

export interface SosRecord {
  _id: string;
  victimId: string;
  lat: number;
  lng: number;
  description: string;
  severity: Severity;
  category: string;
  status: SosStatus;
  matchedVolunteers: string[];
  acceptedBy: string | null;
  createdAt: string;
}

export const SEVERITY_STYLES: Record<Severity, { bg: string; text: string; label: string }> = {
  high: { bg: "bg-danger-50", text: "text-danger-600", label: "High" },
  medium: { bg: "bg-amber-50", text: "text-amber-600", label: "Medium" },
  low: { bg: "bg-safe-50", text: "text-safe-700", label: "Low" },
  pending: { bg: "bg-ink/5", text: "text-ink/40", label: "Assessing…" },
};

export const STATUS_STEPS: { key: SosStatus; label: string }[] = [
  { key: "open", label: "Sent" },
  { key: "matched", label: "Matching" },
  { key: "accepted", label: "Accepted" },
  { key: "resolved", label: "Resolved" },
  { key: "cancelled", label: "Cancelled" },
  { key: "volunteer_not_found", label: "No volunteer found" },
];
