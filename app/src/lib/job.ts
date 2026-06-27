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
  googleEventId?: string | null;
  driveFolderId?: string | null;
  notes?: string | null;
  documents?: DocumentDTO[];
  reports?: ReportDTO[];
  activities?: ActivityDTO[];
  _count?: { reports: number };
}

export interface DocumentDTO {
  id: string;
  name: string;
  webViewLink?: string | null;
  source: string;
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
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}
