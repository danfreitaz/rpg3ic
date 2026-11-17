# RPG3ic

Mesa de RPG narrativo no navegador, herdeira do velho RPG2ic. Chat em tempo real com dados, fichas vivas, mapa com névoa de guerra, iniciativa e um mestre com poderes de verdade.

**Stack:** Next.js 16 · Neon Postgres 18 (Realtime + Managed Better Auth) · Vercel · orçamento zero.

## Variáveis de ambiente

| Chave | De onde vem |
| --- | --- |
| `DATABASE_URL` | Neon → Connection string (pooler) |
| `NEON_AUTH_BASE_URL` | Neon → Auth → URL |
| `NEON_AUTH_COOKIE_SECRET` | `openssl rand -base64 32` |
| `NEON_REALTIME_URL` | Neon → Realtime → URL |
| `NEON_REALTIME_SECRET` | Neon → Realtime → segredo (nunca no navegador) |

## Como funciona

- `src/lib/realtime.ts`: as cinco consultas vivas da sala (sala, pessoas, mensagens, fichas, notas). A visibilidade de sussurros, rolagens secretas e fichas ocultas é decidida no SQL, no servidor.
- `src/lib/commands.ts`: todos os comandos do chat (`/r`, `/pv`, `/init`, `/cond`, `/npc`, `/desfazer`…).
- `src/lib/dice.ts`: o rolador (`4d6kh3`, `3d6!`, `1d20+FOR`).
- `src/app/api/rooms/[code]/act`: ações de fichas, modelos, mapa, iniciativa e sala.
- `src/components/room/`: a mesa (três painéis, chat, mapa, turnos, dados, diário).
- Convidados sem conta entram com o código da sala (cookie assinado).

## Desenvolvimento

```bash
npm install
npm run dev
```
