"use client"
// Silhuetas de peças para o mapa, desenhadas em SVG e pintadas com a cor da peça.

const S = "#1b1008" // contorno
const E = "#fff7e0" // olhos e brilhos

type Shape = { id: string; name: string; group: "Heróis" | "Criaturas" | "Mortos-vivos" | "Objetos"; draw: (c: string) => React.ReactNode }

export const SHAPES: Shape[] = [
  { id: "circle", name: "Círculo", group: "Objetos", draw: (c) => <circle cx="32" cy="32" r="26" fill={c} stroke={S} strokeWidth="3" /> },
  {
    id: "warrior", name: "Guerreiro", group: "Heróis", draw: (c) => (
      <g stroke={S} strokeWidth="2.5" strokeLinejoin="round">
        <path d="M44 8l4 4-16 22-4-4z" fill="#d9d9d9" />
        <path d="M30 30l6 6-3 3-6-6z" fill="#8a6114" />
        <path d="M20 14c0-6 5-9 10-9s10 3 10 9v6H20z" fill="#9aa0a8" />
        <path d="M22 18h16" />
        <path d="M14 30c0-6 8-10 16-10s16 4 16 10v22H14z" fill={c} />
        <path d="M8 30h14v14c0 6-7 10-7 10s-7-4-7-10z" fill={c} />
        <path d="M15 34v14" stroke={E} />
      </g>
    ),
  },
  {
    id: "soldier", name: "Soldado", group: "Heróis", draw: (c) => (
      <g stroke={S} strokeWidth="2.5" strokeLinejoin="round">
        <path d="M50 4l-2 56" />
        <path d="M46 4l4-4 4 4-4 8z" fill="#d9d9d9" />
        <path d="M18 16c0-7 6-10 12-10s12 3 12 10v3H18z" fill="#9aa0a8" />
        <path d="M14 18h32" />
        <circle cx="30" cy="24" r="6" fill="#e8c9a0" />
        <path d="M14 34c0-5 7-8 16-8s16 3 16 8v24H14z" fill={c} />
        <path d="M14 42h32" stroke="#8a6114" />
      </g>
    ),
  },
  {
    id: "archer", name: "Arqueiro", group: "Heróis", draw: (c) => (
      <g stroke={S} strokeWidth="2.5" strokeLinejoin="round">
        <path d="M48 8c10 12 10 36 0 48" fill="none" />
        <path d="M48 8v48" strokeWidth="1.2" />
        <path d="M30 6c-8 0-12 6-12 14 0 3 2 6 4 7h16c2-1 4-4 4-7 0-8-4-14-12-14z" fill={c} />
        <circle cx="30" cy="20" r="5" fill="#e8c9a0" />
        <path d="M16 34c0-5 6-8 14-8s14 3 14 8v24H16z" fill={c} />
        <path d="M22 30l16 22" stroke="#8a6114" />
      </g>
    ),
  },
  {
    id: "mage", name: "Mago", group: "Heróis", draw: (c) => (
      <g stroke={S} strokeWidth="2.5" strokeLinejoin="round">
        <path d="M50 14v46" stroke="#8a6114" strokeWidth="3" />
        <circle cx="50" cy="10" r="6" fill="#7fd3ff" />
        <path d="M30 2l10 20H20z" fill={c} />
        <path d="M16 22h28" />
        <circle cx="30" cy="27" r="5" fill="#e8c9a0" />
        <path d="M26 30c0 6 8 6 8 0" fill={E} />
        <path d="M18 60l4-26c2-3 14-3 16 0l4 26z" fill={c} />
      </g>
    ),
  },
  {
    id: "rogue", name: "Ladino", group: "Heróis", draw: (c) => (
      <g stroke={S} strokeWidth="2.5" strokeLinejoin="round">
        <path d="M32 4c-10 0-16 8-16 18 0 4 2 8 4 10h24c2-2 4-6 4-10 0-10-6-18-16-18z" fill={c} />
        <path d="M24 20c2-2 14-2 16 0v6H24z" fill="#2a2a2a" />
        <circle cx="28" cy="23" r="1.5" fill={E} stroke="none" /><circle cx="36" cy="23" r="1.5" fill={E} stroke="none" />
        <path d="M18 60l2-24c4-4 20-4 24 0l2 24z" fill={c} />
        <path d="M8 40l10 6M56 40l-10 6" stroke="#d9d9d9" strokeWidth="3" />
      </g>
    ),
  },
  {
    id: "bat", name: "Morcego", group: "Criaturas", draw: (c) => (
      <g stroke={S} strokeWidth="2.5" strokeLinejoin="round">
        <path d="M32 22c-4-6-12-10-28-6 6 4 6 10 4 16 6-4 12-2 14 4 2-4 6-6 10-6s8 2 10 6c2-6 8-8 14-4-2-6-2-12 4-16-16-4-24 0-28 6z" fill={c} />
        <path d="M26 22l2-8 4 6 4-6 2 8" fill={c} />
        <circle cx="28" cy="26" r="2" fill="#ff5a3c" stroke="none" /><circle cx="36" cy="26" r="2" fill="#ff5a3c" stroke="none" />
        <path d="M29 32l1 3 2-2 2 2 1-3" fill={E} strokeWidth="1" />
      </g>
    ),
  },
  {
    id: "spider", name: "Aranha", group: "Criaturas", draw: (c) => (
      <g stroke={S} strokeWidth="2.5" strokeLinecap="round" fill="none">
        <path d="M26 30L12 18 6 24M26 34L8 32 4 40M38 30l14-12 6 6M38 34l18-2 4 8M27 38L14 48 12 58M37 38l13 10 2 10M29 40l-6 12M35 40l6 12" />
        <ellipse cx="32" cy="42" rx="11" ry="12" fill={c} />
        <circle cx="32" cy="27" r="8" fill={c} />
        <circle cx="29" cy="25" r="1.6" fill="#ff5a3c" stroke="none" /><circle cx="35" cy="25" r="1.6" fill="#ff5a3c" stroke="none" />
        <circle cx="31" cy="29" r="1" fill="#ff5a3c" stroke="none" /><circle cx="33" cy="29" r="1" fill="#ff5a3c" stroke="none" />
      </g>
    ),
  },
  {
    id: "slime", name: "Slime", group: "Criaturas", draw: (c) => (
      <g stroke={S} strokeWidth="2.5" strokeLinejoin="round">
        <path d="M8 54c0-14 8-34 24-38 16 4 24 24 24 38 0 4-4 6-8 4-2 2-6 2-8 0-2 2-6 2-8 0-2 2-6 2-8 0-2 2-6 2-8 0-4 2-8 0-8-4z" fill={c} />
        <path d="M18 30c2-4 6-7 10-8" stroke={E} strokeWidth="3" fill="none" opacity=".7" />
        <ellipse cx="25" cy="40" rx="3.5" ry="5" fill={E} /><ellipse cx="39" cy="40" rx="3.5" ry="5" fill={E} />
        <circle cx="25" cy="41" r="1.8" fill={S} stroke="none" /><circle cx="39" cy="41" r="1.8" fill={S} stroke="none" />
      </g>
    ),
  },
  {
    id: "goblin", name: "Goblin", group: "Criaturas", draw: (c) => (
      <g stroke={S} strokeWidth="2.5" strokeLinejoin="round">
        <path d="M18 26L2 16l8 18zM46 26l16-10-8 18z" fill={c} />
        <ellipse cx="32" cy="30" rx="15" ry="16" fill={c} />
        <path d="M24 26l6 2M40 26l-6 2" />
        <circle cx="26" cy="31" r="2.2" fill="#ffd34d" stroke="none" /><circle cx="38" cy="31" r="2.2" fill="#ffd34d" stroke="none" />
        <path d="M24 40c4 4 12 4 16 0" fill="none" />
        <path d="M27 40l2 3 2-3M33 40l2 3 2-3" fill={E} strokeWidth="1" />
        <path d="M18 60c0-8 6-12 14-12s14 4 14 12" fill={c} />
      </g>
    ),
  },
  {
    id: "wolf", name: "Lobo", group: "Criaturas", draw: (c) => (
      <g stroke={S} strokeWidth="2.5" strokeLinejoin="round">
        <path d="M14 8l8 14M50 8l-8 14" />
        <path d="M14 6l10 14H12zM50 6L40 20h12z" fill={c} />
        <path d="M12 20h40l-4 16-10 18h-12L16 36z" fill={c} />
        <path d="M24 42l8 14 8-14z" fill="#e8dcc0" />
        <circle cx="31.5" cy="44" r="2.5" fill={S} stroke="none" />
        <path d="M20 30l6 2M44 30l-6 2" />
        <circle cx="24" cy="32" r="1.8" fill="#ffd34d" stroke="none" /><circle cx="40" cy="32" r="1.8" fill="#ffd34d" stroke="none" />
      </g>
    ),
  },
  {
    id: "dragon", name: "Dragão", group: "Criaturas", draw: (c) => (
      <g stroke={S} strokeWidth="2.5" strokeLinejoin="round">
        <path d="M30 30C20 12 10 8 2 10c6 4 8 10 6 18 6-4 12-2 16 4zM34 30c10-18 20-22 28-20-6 4-8 10-6 18-6-4-12-2-16 4z" fill={c} opacity=".85" />
        <ellipse cx="32" cy="42" rx="10" ry="14" fill={c} />
        <path d="M26 22l-2-8 6 6M38 22l2-8-6 6" fill={c} />
        <path d="M24 22c0-6 16-6 16 0v8c0 4-4 8-8 8s-8-4-8-8z" fill={c} />
        <circle cx="28" cy="27" r="1.8" fill="#ffd34d" stroke="none" /><circle cx="36" cy="27" r="1.8" fill="#ffd34d" stroke="none" />
        <path d="M32 56c2 4 8 6 12 4" fill="none" />
      </g>
    ),
  },
  {
    id: "skeleton", name: "Esqueleto", group: "Mortos-vivos", draw: (c) => (
      <g stroke={S} strokeWidth="2.5" strokeLinejoin="round">
        <path d="M12 56l40-16M12 40l40 16" stroke={E} strokeWidth="5" strokeLinecap="round" />
        <path d="M12 56l40-16M12 40l40 16" strokeWidth="1" />
        <path d="M16 26c0-12 7-20 16-20s16 8 16 20c0 6-3 9-6 10v6H22v-6c-3-1-6-4-6-10z" fill={c === "#b9a27a" ? E : c} />
        <path d="M26 42v-4M32 42v-4M38 42v-4" />
        <path d="M21 25c0-3 8-3 8 2 0 3-8 3-8-2zM35 27c0-5 8-5 8-2 0 5-8 5-8 2z" fill={S} />
        <path d="M30 32l2-4 2 4z" fill={S} />
      </g>
    ),
  },
  {
    id: "zombie", name: "Zumbi", group: "Mortos-vivos", draw: (c) => (
      <g stroke={S} strokeWidth="2.5" strokeLinejoin="round">
        <path d="M14 34L2 30M50 34l12-6" strokeWidth="6" stroke={c} strokeLinecap="round" />
        <path d="M14 34L2 30M50 34l12-6" strokeWidth="1" />
        <path d="M20 6h24l2 22c0 6-6 10-14 10s-14-4-14-10z" fill={c} />
        <path d="M26 10l4 4-4 4M36 8v8M34 12h4" strokeWidth="1.5" />
        <circle cx="26" cy="24" r="3" fill={E} /><circle cx="26" cy="24" r="1" fill={S} stroke="none" />
        <path d="M35 22l6 4M41 22l-6 4" />
        <path d="M26 32h12" />
        <path d="M16 60l2-20c4-3 24-3 28 0l2 20h-8l-2-6-4 6h-8z" fill={c} />
      </g>
    ),
  },
  {
    id: "ghost", name: "Fantasma", group: "Mortos-vivos", draw: (c) => (
      <g stroke={S} strokeWidth="2.5" strokeLinejoin="round">
        <path d="M14 58V28C14 14 22 6 32 6s18 8 18 22v30l-6-6-6 6-6-6-6 6-6-6z" fill={c} opacity=".9" />
        <ellipse cx="25" cy="28" rx="3.5" ry="5" fill={S} /><ellipse cx="39" cy="28" rx="3.5" ry="5" fill={S} />
        <ellipse cx="32" cy="40" rx="4" ry="5" fill={S} />
      </g>
    ),
  },
  {
    id: "chest", name: "Baú", group: "Objetos", draw: (c) => (
      <g stroke={S} strokeWidth="2.5" strokeLinejoin="round">
        <path d="M8 30c0-12 10-16 24-16s24 4 24 16z" fill={c} />
        <rect x="8" y="30" width="48" height="24" rx="2" fill={c} />
        <path d="M18 14v40M46 14v40" stroke="#d9ad45" strokeWidth="4" />
        <path d="M8 30h48" />
        <rect x="27" y="26" width="10" height="12" rx="2" fill="#d9ad45" />
        <circle cx="32" cy="32" r="1.6" fill={S} stroke="none" />
      </g>
    ),
  },
  {
    id: "fire", name: "Fogueira", group: "Objetos", draw: () => (
      <g stroke={S} strokeWidth="2.5" strokeLinejoin="round">
        <path d="M10 54l44-8M10 46l44 8" stroke="#8a6114" strokeWidth="6" strokeLinecap="round" />
        <path d="M32 6c4 10 14 14 14 28 0 8-6 14-14 14s-14-6-14-14c0-8 6-10 6-18 4 4 6 6 6 10 4-6 2-12 2-20z" fill="#ff8a2a" />
        <path d="M32 26c2 6 6 8 6 14 0 4-3 6-6 6s-6-2-6-6c0-4 4-6 6-14z" fill="#ffd34d" />
      </g>
    ),
  },
  {
    id: "door", name: "Porta", group: "Objetos", draw: (c) => (
      <g stroke={S} strokeWidth="2.5" strokeLinejoin="round">
        <path d="M14 58V22c0-10 8-16 18-16s18 6 18 16v36z" fill={c} />
        <path d="M24 12v46M32 7v51M40 12v46" strokeWidth="1.2" />
        <path d="M14 30h36M14 46h36" stroke="#5a5a5a" strokeWidth="3" />
        <circle cx="42" cy="38" r="2.5" fill="#d9ad45" />
      </g>
    ),
  },
]

export const shapeById = (id?: string) => SHAPES.find((s) => s.id === id)

export function ShapeSvg({ id, color, size = 64 }: { id?: string; color: string; size?: number }) {
  const s = shapeById(id) ?? SHAPES[0]
  return <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden style={{ overflow: "visible" }}>{s.draw(color)}</svg>
}
