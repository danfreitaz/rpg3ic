// Tipos e modelos compartilhados entre servidor e navegador.

export type FieldType = "bar" | "num" | "text" | "long"
export type Field = { key: string; label: string; type: FieldType; def?: number | string }
export type Template = { id: string; name: string; kind: "pc" | "npc" | "creature"; fields: Field[] }

export type Token = { id: string; label: string; sheet_id?: string | null; x: number; y: number; color: string; hidden?: boolean; size?: number }
export type MapState = { image: string; cols: number; rows: number; fogOn: boolean; fog: string; tokens: Record<string, Token> }
export type InitEntry = { id: string; name: string; init: number; sheet_id?: string | null }
export type InitState = { on: boolean; round: number; turn: number; order: InitEntry[] }
export type Cond = { n: string; r: number | null }

export type Room = {
  id: string; code: string; name: string; owner_id: string; gm_locked: boolean; public: boolean
  skin: string; scene: string; map: MapState; init: InitState; templates: Template[]
}
export type Member = { id: string; name: string; role: "gm" | "player"; color: string; sheet_id: string | null }
export type Sheet = {
  id: string; template_id: string; kind: "pc" | "npc" | "creature"; owner_member: string | null
  name: string; avatar: string; data: Record<string, any>; hidden: boolean
}
export type Note = { id: string; kind: "story" | "place" | "diary"; title: string; body: string; hidden: boolean; author_member: string | null; created_at: Date }
export type Msg = {
  seq: number; member_id: string; kind: string; speaker: string; color: string; body: string
  data: any; to_member: string | null; secret: boolean; created_at: Date
}

export const norm = (s: string) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[\s_]+/g, "")

export const EMPTY_MAP: MapState = { image: "", cols: 24, rows: 16, fogOn: false, fog: "", tokens: {} }
export const EMPTY_INIT: InitState = { on: false, round: 1, turn: 0, order: [] }

export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: "aventureiro", name: "Aventureiro", kind: "pc",
    fields: [
      { key: "pv", label: "Pontos de Vida", type: "bar", def: 20 },
      { key: "pm", label: "Pontos de Mana", type: "bar", def: 10 },
      { key: "nivel", label: "Nível", type: "num", def: 1 },
      { key: "for", label: "Força", type: "num", def: 0 },
      { key: "des", label: "Destreza", type: "num", def: 0 },
      { key: "con", label: "Constituição", type: "num", def: 0 },
      { key: "int", label: "Inteligência", type: "num", def: 0 },
      { key: "sab", label: "Sabedoria", type: "num", def: 0 },
      { key: "car", label: "Carisma", type: "num", def: 0 },
      { key: "def", label: "Defesa", type: "num", def: 10 },
      { key: "classe", label: "Classe", type: "text", def: "" },
      { key: "origem", label: "Origem", type: "text", def: "" },
      { key: "inventario", label: "Inventário", type: "long", def: "" },
      { key: "notas", label: "Anotações", type: "long", def: "" },
    ],
  },
  {
    id: "simples", name: "Ficha Simples", kind: "pc",
    fields: [
      { key: "pv", label: "Pontos de Vida", type: "bar", def: 10 },
      { key: "corpo", label: "Corpo", type: "num", def: 1 },
      { key: "mente", label: "Mente", type: "num", def: 1 },
      { key: "alma", label: "Alma", type: "num", def: 1 },
      { key: "notas", label: "Anotações", type: "long", def: "" },
    ],
  },
  {
    id: "npc", name: "NPC", kind: "npc",
    fields: [
      { key: "pv", label: "Pontos de Vida", type: "bar", def: 10 },
      { key: "atq", label: "Ataque", type: "num", def: 0 },
      { key: "def", label: "Defesa", type: "num", def: 10 },
      { key: "papel", label: "Papel na história", type: "text", def: "" },
      { key: "atitude", label: "Atitude", type: "text", def: "" },
      { key: "segredo", label: "Segredo", type: "long", def: "" },
    ],
  },
  {
    id: "criatura", name: "Criatura", kind: "creature",
    fields: [
      { key: "pv", label: "Pontos de Vida", type: "bar", def: 30 },
      { key: "atq", label: "Ataque", type: "num", def: 3 },
      { key: "def", label: "Defesa", type: "num", def: 12 },
      { key: "dano", label: "Dano", type: "text", def: "1d8+2" },
      { key: "habilidades", label: "Habilidades", type: "long", def: "" },
    ],
  },
]

export function blankData(t: Template): Record<string, any> {
  const d: Record<string, any> = {}
  for (const f of t.fields) {
    if (f.type === "bar") { d[f.key] = Number(f.def ?? 10); d[f.key + "_max"] = Number(f.def ?? 10) }
    else if (f.type === "num") d[f.key] = Number(f.def ?? 0)
    else d[f.key] = String(f.def ?? "")
  }
  return d
}

export const COLORS = ["#c9a24b", "#b5533c", "#5f8f6a", "#4f7fa8", "#8a63a8", "#c77f3a", "#a84f6d", "#6b8f8f", "#d6c08d", "#7a7f52"]
