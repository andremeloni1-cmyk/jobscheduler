// Shared icon set. One consistent visual language across the app: 24×24 grid,
// stroke-based (currentColor, width 2, round caps) so icons inherit text colour
// and size via `className`. Replaces emoji used as structural icons (which render
// inconsistently across platforms and confuse screen readers).
//
// Icons are decorative by default (aria-hidden) — when an icon is the *only*
// content of a button/link, label the control with aria-label instead.

type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className ?? "h-4 w-4"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function PaperclipIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M21 11.5l-8.5 8.5a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8" />
    </Svg>
  );
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </Svg>
  );
}

export function PinIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </Svg>
  );
}

export function PhoneIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5 4h3.5l1.5 4-2 1.5a12 12 0 0 0 5 5l1.5-2 4 1.5V19a2 2 0 0 1-2 2A16 16 0 0 1 4 6a2 2 0 0 1 1-2z" />
    </Svg>
  );
}

export function NavigationIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3 11l18-8-8 18-2-8-8-2z" />
    </Svg>
  );
}

export function MailIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </Svg>
  );
}

export function WrenchIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M15 6.5a4 4 0 0 0-5.3 4.7l-5.4 5.4a1.5 1.5 0 0 0 2.1 2.1l5.4-5.4A4 4 0 0 0 17.5 9l-2.3 2.3-2.1-.5-.5-2.1L15 6.5z" />
    </Svg>
  );
}

export function DocumentIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </Svg>
  );
}

export function ImageIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="9.5" r="1.6" />
      <path d="M21 16l-5-5-7 7" />
    </Svg>
  );
}

export function UserIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M5 21c0-3.9 3.1-7 7-7s7 3.1 7 7" />
    </Svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5 13l4 4L19 7" />
    </Svg>
  );
}

export function CheckCircleIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </Svg>
  );
}

export function WarningIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3l9 16H3z" />
      <path d="M12 10v4M12 17.5v.01" />
    </Svg>
  );
}

export function RefreshIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 12a8 8 0 0 1 13.7-5.6L20 8M20 4v4h-4" />
      <path d="M20 12a8 8 0 0 1-13.7 5.6L4 16M4 20v-4h4" />
    </Svg>
  );
}

export function SparkleIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3l1.8 4.9L19 9.5l-5.2 1.6L12 16l-1.8-4.9L5 9.5l5.2-1.6L12 3z" />
    </Svg>
  );
}

export function NoteIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 20l1-4 11-11 3 3L8 19l-4 1z" />
      <path d="M13.5 6.5l3 3" />
    </Svg>
  );
}

export function InboxIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 13l2.5-7h11L20 13" />
      <path d="M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5h-5a3 3 0 0 1-6 0H4z" />
    </Svg>
  );
}

export function ArrowRightIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  );
}
