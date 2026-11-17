// Ícones desenhados à mão em SVG, no traço da skin medieval.
const P: Record<string, string> = {
  d20: "M12 2 21 7v10l-9 5-9-5V7zM12 2 7.5 9.5h9zM3 7l4.5 2.5L12 22M21 7l-4.5 2.5L12 22M7.5 9.5 3 17M16.5 9.5 21 17M7.5 9.5h9L12 17z",
  d6: "M4 6.5 12 2l8 4.5v11L12 22l-8-4.5zM4 6.5 12 11l8-4.5M12 11v11",
  sword: "M14.5 3H21v6.5L10 20.5l-3.5-3.5zM6.5 17 3 20.5M5 14l5 5M8 18l-2 2",
  shield: "M12 2 20 5v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5zM12 2v20",
  scroll: "M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8M6 4a2 2 0 0 0-2 2v2h4V6a2 2 0 0 0-2-2zM8 8v10a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-1h4M11 9h5M11 12h5M11 15h3",
  map: "M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14",
  crown: "M3 8l4 4 5-7 5 7 4-4-2 11H5zM5 19h14",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4.5-6 8-6s7 2 8 6",
  users: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.8-3.5 3.5-5 6.5-5s5.7 1.5 6.5 5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 15c2 .6 3.2 2.2 3.5 5",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  eyeoff: "M3 3l18 18M10.5 5.2A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2",
  skull: "M12 2C7 2 4 5.5 4 10c0 2.6 1.2 4.4 3 5.5V19h10v-3.5c1.8-1.1 3-2.9 3-5.5 0-4.5-3-8-8-8zM9 12.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM15 12.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM10 19v3M14 19v3",
  heart: "M12 20s-8-4.8-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6.2-8 11-8 11z",
  flask: "M9 2h6M10 2v6L4.5 18A2.5 2.5 0 0 0 6.7 22h10.6a2.5 2.5 0 0 0 2.2-4L14 8V2M7 15h10",
  quill: "M20 3c-7 0-12 5-14 13l-2 5 5-2c8-2 13-7 13-14V3zM6 16l7-7M10 14h5",
  book: "M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5zM4 21.5A2.5 2.5 0 0 1 6.5 19H20v3H6.5M9 7h7M9 10h5",
  castle: "M3 21V9h3V6h2v3h2V6h4v3h2V6h2v3h3v12zM9 21v-5a3 3 0 0 1 6 0v5M3 13h18",
  hourglass: "M6 2h12M6 22h12M7 2c0 5 5 6 5 10S7 17 7 22M17 2c0 5-5 6-5 10s5 5 5 10",
  undo: "M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
  gear: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 21a2 2 0 0 0 4 0",
  mute: "M11 5 6 9H3v6h3l5 4zM16 9l5 6M21 9l-5 6",
  sound: "M11 5 6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13",
  door: "M5 21V4a1 1 0 0 1 1-1h9l4 2v16M3 21h18M15 3v18M12 12h.01",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  x: "M6 6l12 12M18 6 6 18",
  check: "M4 12.5 9.5 18 20 6.5",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6",
  pin: "M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  whisper: "M21 12a8 8 0 0 1-11.8 7L3 21l2-5.5A8 8 0 1 1 21 12zM8.5 12h.01M12 12h.01M15.5 12h.01",
  brush: "M18.4 2.6a2 2 0 0 1 2.9 2.9L11 15.8 8.2 13zM8 14c-2.5 0-4 1.8-4 4 0 1.2-.6 2.2-2 3 3.5.8 7.5 0 8-4",
  cloud: "M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19.5 10 4 4 0 0 1 18 18z",
  move: "M12 2v20M2 12h20M12 2 9 5M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3",
  flame: "M12 22c4 0 7-3 7-7 0-4.5-4-6.5-4-11-3 1.5-5 4.5-4.5 8-1.5-1-2.5-2.5-2.5-4C5.5 10 5 12.5 5 15c0 4 3 7 7 7z",
  star: "M12 2.5l2.9 6.2 6.6.8-4.9 4.6 1.3 6.6L12 17.4l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z",
  help: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01",
  send: "M22 2 11 13M22 2l-7 20-4-9-9-4z",
  palette: "M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-2.2a1.8 1.8 0 0 0-1.3 3.1c.8.9.3 2.9-2.5 2.9zM7.5 11.5h.01M10.5 7h.01M15.5 7.5h.01M17.5 11.5h.01",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
}

export function Icon({ n, size = 18, className = "", title }: { n: keyof typeof P | string; size?: number; className?: string; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={"ic " + className} aria-hidden={!title} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <path d={P[n] ?? P.help} />
    </svg>
  )
}

/** Arabesco de canto para molduras. */
export function Flourish({ className = "" }: { className?: string }) {
  return (
    <svg className={"flourish " + className} viewBox="0 0 120 16" aria-hidden>
      <path d="M2 8h38M80 8h38M40 8c6-6 12-6 14 0s8 6 12 0 8-6 14 0" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="60" cy="8" r="2.5" fill="currentColor" />
      <circle cx="2" cy="8" r="1.6" fill="currentColor" />
      <circle cx="118" cy="8" r="1.6" fill="currentColor" />
    </svg>
  )
}

/** Selo do RPG3ic. */
export function Seal({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="seal" aria-hidden>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6dc95" />
          <stop offset=".5" stopColor="#c9a24b" />
          <stop offset="1" stopColor="#7d5416" />
        </linearGradient>
      </defs>
      <polygon points="32,3 58,18 58,46 32,61 6,46 6,18" fill="#24160d" stroke="url(#sg)" strokeWidth="3.5" />
      <polygon points="32,11 51,43 13,43" fill="none" stroke="url(#sg)" strokeWidth="2" />
      <path d="M32 11 22 30h20zM13 43l9-13M51 43 42 30M22 30l10 13 10-13" fill="none" stroke="url(#sg)" strokeWidth="1" opacity=".7" />
      <text x="32" y="38" fontFamily="Cinzel, Georgia, serif" fontWeight="700" fontSize="13" textAnchor="middle" fill="#f6dc95">3</text>
    </svg>
  )
}
