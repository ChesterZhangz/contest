interface AppLogoProps {
  size?: number
  className?: string
}

/**
 * BusyBee brand logo — used across the app in sidebar and header.
 */
export function AppLogo({ size = 32, className = '' }: AppLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Trophy cup body */}
      <path
        d="M32 12 L25 12 L25 31 C25 37 29 41.5 32 43 C35 41.5 39 37 39 31 L39 12 Z"
        fill="white"
        opacity="0.97"
      />
      {/* Left handle */}
      <path
        d="M25 17 L18 17 C18 17 17 25 23 27.5 L25 27.5"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />
      {/* Right handle */}
      <path
        d="M39 17 L46 17 C46 17 47 25 41 27.5 L39 27.5"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />
      {/* Stem */}
      <rect x="29.5" y="43" width="5" height="8" rx="1.5" fill="white" opacity="0.9" />
      {/* Base */}
      <rect x="23" y="51" width="18" height="3.5" rx="1.75" fill="white" opacity="0.9" />
      {/* Star sparkles */}
      <circle cx="19" cy="13" r="2" fill="white" opacity="0.45" />
      <circle cx="45" cy="13" r="2" fill="white" opacity="0.45" />
      <circle cx="21" cy="46" r="1.5" fill="white" opacity="0.35" />
      <circle cx="43" cy="46" r="1.5" fill="white" opacity="0.35" />
    </svg>
  )
}
