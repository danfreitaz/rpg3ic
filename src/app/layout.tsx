import type { Metadata } from "next"
import "./globals.css"
import "./skins.css"

export const metadata: Metadata = {
  title: "RPG3ic — mesa de RPG online",
  description: "Chat de RPG narrativo no navegador: dados, fichas vivas, mapa, iniciativa e um mestre com poderes de verdade.",
  icons: { icon: "/favicon.svg" },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-skin="medieval">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700&family=Cinzel:wght@500;700&family=EB+Garamond:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;600&family=Inter:wght@400;500;600;700&family=Orbitron:wght@500;700;900&family=Share+Tech+Mono&family=VT323&display=swap"
        />
      </head>
      <body>
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
          <filter id="paper">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed="7" />
            <feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0 0.12  0 0 0 0.5 0" />
          </filter>
        </svg>
        {children}
      </body>
    </html>
  )
}
