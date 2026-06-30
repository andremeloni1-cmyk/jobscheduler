// Lightweight client-side shape of a Job (dates arrive as ISO strings via JSON).

export interface JobDTO {
  id: string;
  reference: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  durationMins: number;
  quoteAmount?: number | null;
  currency: string;
  address?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  companyId?: string | null;
  companyName?: string | null; // resolved client-company display name (server-attached)
  googleEventId?: string | null;
  driveFolderId?: string | null;
  drivePhotosFolderId?: string | null;
  photosLink?: string | null; // shareable client link to the job's photos folder
  leadSource?: string | null;
  gmailMessageId?: string | null;
  flag?: string | null;
  notes?: string | null;
  checklist?: ChecklistItem[]; // on-site to-do list (server parses from JSON)
  deletedAt?: string | null;
  createdAt?: string;
  documents?: DocumentDTO[];
  reports?: ReportDTO[];
  activities?: ActivityDTO[];
  _count?: { reports: number };
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface DocumentDTO {
  id: string;
  name: string;
  webViewLink?: string | null;
  source: string;
  mimeType?: string;
  createdAt: string;
}

export interface ReportDTO {
  id: string;
  status: string;
  data?: string;
  webViewLink?: string | null;
  sentAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ActivityDTO {
  id: string;
  type: string;
  message: string;
  createdAt: string;
}

export async function api<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    // Never serve API reads from the browser HTTP cache — otherwise the jobs
    // list / inbox can show stale state after a mutation (a confirmed lead or
    // saved job appearing not to "go away" until a hard refresh).
    cache: "no-store",
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}
