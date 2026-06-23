import type { ReactNode } from "react";

type IconProps = { className?: string };

function Svg({
  children,
  className = "h-5 w-5",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconSparkles = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.8 3.3 11 7l3.7 1.2L11 9.4 9.8 13 8.6 9.4 4.9 8.2 8.6 7z" />
    <path d="M18 3v3.5M19.75 4.75h-3.5M18.5 15v3M20 16.5h-3" />
  </Svg>
);
export const IconChat = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Svg>
);
export const IconGraph = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="6" cy="6" r="2.4" />
    <circle cx="18" cy="7" r="2.4" />
    <circle cx="12" cy="17.5" r="2.4" />
    <path d="M8 7 10.4 15.4M15.7 9 13 15.5" />
  </Svg>
);
export const IconDashboard = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </Svg>
);
export const IconBook = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 7v13" />
    <path d="M3 18a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6a3 3 0 0 1 3 3 3 3 0 0 1 3-3h6a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-7a2 2 0 0 0-2 2 2 2 0 0 0-2-2z" />
  </Svg>
);
export const IconActivity = (p: IconProps) => (
  <Svg {...p}>
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </Svg>
);
export const IconHelp = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4" />
    <path d="M12 17h.01" />
  </Svg>
);
export const IconUser = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </Svg>
);
export const IconRoute = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="6" cy="19" r="2.5" />
    <circle cx="18" cy="5" r="2.5" />
    <path d="M8.5 19H16a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h7.5" />
  </Svg>
);
export const IconSend = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14.5 21 21 3 3 9.5l7 2.8z" />
    <path d="M21 3 10 14" />
  </Svg>
);
export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Svg>
);
export const IconChevron = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);
export const IconPlay = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 4 14 8-14 8z" />
  </Svg>
);
export const IconPause = (p: IconProps) => (
  <Svg {...p}>
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </Svg>
);
export const IconReplay = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
  </Svg>
);
export const IconLock = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4.5" y="11" width="15" height="9" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Svg>
);
export const IconStar = ({ className = "h-5 w-5" }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.77l-5.2 2.73.99-5.79-4.21-4.1 5.82-.85z" />
  </svg>
);
