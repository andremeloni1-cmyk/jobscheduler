// Default automated-email templates. Pure data (no imports) so this can be
// shared by the Prisma seed and the Settings UI's "Reset to default" action.
// Placeholders: {{clientName}} {{jobTitle}} {{reference}} {{address}}
//   {{startDate}} {{startTime}} {{endTime}} {{duration}} {{clientPhone}}
//   {{ownerName}} {{businessPhone}} {{businessEmail}}

export type DefaultTemplate = { key: string; subject: string; body: string };

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    key: "accepted",
    subject: "You're booked in — {{jobTitle}}",
    body:
      "Hi {{clientName}},\n\n" +
      "Good news — your job \"{{jobTitle}}\" is confirmed for {{startDate}}, {{startTime}}–{{endTime}} ({{duration}}).\n\n" +
      "Address: {{address}}\n" +
      "Reference: {{reference}}\n\n" +
      "We'll be in touch the day before to confirm. If anything needs changing, just reply to this email.\n\n" +
      "Kind regards,\n{{ownerName}}",
  },
  {
    key: "moved",
    subject: "New time for your job — {{jobTitle}}",
    body:
      "Hi {{clientName}},\n\n" +
      "Just letting you know your job \"{{jobTitle}}\" has moved to {{startDate}}, {{startTime}}–{{endTime}} ({{duration}}).\n\n" +
      "Address: {{address}}\n" +
      "Reference: {{reference}}\n\n" +
      "Apologies for any inconvenience — reply to this email if that time doesn't suit and we'll find another slot.\n\n" +
      "Kind regards,\n{{ownerName}}",
  },
  {
    key: "cancelled",
    subject: "Your job has been cancelled — {{jobTitle}}",
    body:
      "Hi {{clientName}},\n\n" +
      "We're sorry to let you know your job \"{{jobTitle}}\" (ref {{reference}}) has been cancelled.\n\n" +
      "If you'd like to rebook, just reply to this email and we'll sort out a new date.\n\n" +
      "Kind regards,\n{{ownerName}}",
  },
  {
    key: "report",
    subject: "Maintenance report — {{jobTitle}} ({{reference}})",
    body:
      "Hi {{clientName}},\n\n" +
      "Please find attached the maintenance report for \"{{jobTitle}}\" (ref {{reference}}).\n\n" +
      "Thanks for your business — if you have any questions, just reply to this email.\n\n" +
      "Kind regards,\n{{ownerName}}",
  },
];

export function defaultTemplate(key: string): DefaultTemplate | undefined {
  return DEFAULT_TEMPLATES.find((t) => t.key === key);
}
