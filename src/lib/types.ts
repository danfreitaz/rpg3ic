// Tipos e modelos compartilhados entre servidor e navegador.

export type FieldType = "bar" | "num" | "text" | "long"
export type Field = { key: string; label: string; type: FieldType; def?: number | string }
/** Como o botão de rolar de cada atributo funciona: d20 + valor, d20 + modificador (D&D), 3d6 contra o valor (GURPS) ou 1d6 + valor (3D&T). */
export type RollStyle = "d20" | "d20mod" | "3d6" | "d6"
export type Template = { id: string; name: string; kind: "pc" | "npc" | "creature"; fields: Field[]; roll?: RollStyle; system?: string }

export type Token = { id: string; label: string; sheet_id?: string | null; x: number; y: number; color: string; hidden?: boolean; size?: number; shape?: string }
export type MapState = { image: string; cols: number; rows: number; fogOn: boolean; fog: string; tokens: Record<string, Token> }
export type InitEntry = { id: string; name: string; init: number; sheet_id?: string | null }
export type InitState = { on: boolean; round: number; turn: number; order: InitEntry[] }
export type Cond = { n: string; r: number | null }

export type Room = {
  id: string; code: string; name: string; owner_id: string; gm_locked: boolean; public: boolean; ambience: string
  skin: string; scene: string; map: MapState; init: InitState; templates: Template[]
}
export type Macro = { name: string; text: string }
export type Member = { id: string; name: string; role: "gm" | "player"; color: string; sheet_id: string | null; macros?: Macro[] }

export const SKINS = [
  { id: "medieval", name: "Taverna", hint: "Madeira, pergaminho e ouro" },
  { id: "minimal", name: "Minimalista", hint: "Papel claro, tinta e silêncio" },
  { id: "modern", name: "Contemporânea", hint: "Vidro fosco e cores vivas" },
  { id: "scifi", name: "Ficção científica", hint: "Neon, grade e terminal" },
  { id: "mirc", name: "mIRC retrô", hint: "Windows 98 e salas de chat" },
] as const

export const AMBIENCES = [
  { id: "", name: "Silêncio", icon: "mute" },
  { id: "taverna", name: "Taverna", icon: "flame" },
  { id: "chuva", name: "Chuva e trovões", icon: "cloud" },
  { id: "floresta", name: "Floresta", icon: "star" },
  { id: "masmorra", name: "Masmorra", icon: "skull" },
  { id: "batalha", name: "Batalha", icon: "sword" },
  { id: "mar", name: "Mar e porto", icon: "map" },
  { id: "vento", name: "Ventania", icon: "move" },
] as const
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

const BASE_TEMPLATES: Template[] = [
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

const f = (key: string, label: string, type: FieldType, def: number | string = type === "num" ? 0 : ""): Field => ({ key, label, type, def })

/** Fichas básicas de sistemas conhecidos (podem ser adicionadas a qualquer sala). */
export const SYSTEM_TEMPLATES: Template[] = [
  {
    id: "gurps", name: "GURPS (básica)", kind: "pc", roll: "3d6", system: "GURPS 4ª ed.",
    fields: [
      f("pv", "Pontos de Vida", "bar", 10), f("pf", "Pontos de Fadiga", "bar", 10),
      f("st", "ST (Força)", "num", 10), f("dx", "DX (Destreza)", "num", 10), f("iq", "IQ (Inteligência)", "num", 10), f("ht", "HT (Vitalidade)", "num", 10),
      f("von", "Vontade", "num", 10), f("per", "Percepção", "num", 10), f("esq", "Esquiva", "num", 8), f("vel", "Velocidade Básica", "num", 5), f("desl", "Deslocamento", "num", 5), f("pts", "Pontos de Personagem", "num", 150),
      f("dano", "Dano (GdP / GeB)", "text", "1d-2 / 1d"), f("vantagens", "Vantagens", "long"), f("desvantagens", "Desvantagens", "long"), f("pericias", "Perícias (NH)", "long"), f("equip", "Equipamento", "long"), f("notas", "Anotações", "long"),
    ],
  },
  {
    id: "3det", name: "3D&T Alpha (básica)", kind: "pc", roll: "d6", system: "3D&T Alpha",
    fields: [
      f("pv", "Pontos de Vida", "bar", 5), f("pm", "Pontos de Magia", "bar", 5),
      f("for", "Força (F)", "num", 1), f("hab", "Habilidade (H)", "num", 1), f("res", "Resistência (R)", "num", 1), f("arm", "Armadura (A)", "num", 0), f("pdf", "Poder de Fogo (PdF)", "num", 0),
      f("pts", "Pontos", "num", 12), f("xp", "Experiência", "num", 0),
      f("vantagens", "Vantagens", "long"), f("desvantagens", "Desvantagens", "long"), f("pericias", "Perícias", "long"), f("magias", "Magias", "long"), f("notas", "Anotações", "long"),
    ],
  },
  {
    id: "dnd5e", name: "D&D 5e (básica)", kind: "pc", roll: "d20mod", system: "D&D 5ª ed.",
    fields: [
      f("pv", "Pontos de Vida", "bar", 10), f("ca", "Classe de Armadura", "num", 10), f("nivel", "Nível", "num", 1), f("prof", "Bônus de Proficiência", "num", 2), f("desl", "Deslocamento (m)", "num", 9),
      f("for", "Força", "num", 10), f("des", "Destreza", "num", 10), f("con", "Constituição", "num", 10), f("int", "Inteligência", "num", 10), f("sab", "Sabedoria", "num", 10), f("car", "Carisma", "num", 10),
      f("classe", "Classe", "text"), f("raca", "Raça / Espécie", "text"), f("antec", "Antecedente", "text"), f("tend", "Tendência", "text"),
      f("pericias", "Perícias e salvaguardas", "long"), f("ataques", "Ataques e magias", "long"), f("equip", "Equipamento", "long"), f("tracos", "Traços e talentos", "long"),
    ],
  },
]

/** Modelos de toda sala nova: os simples, os de sistemas conhecidos e os de NPC/criatura. */
export const DEFAULT_TEMPLATES: Template[] = [...BASE_TEMPLATES.slice(0, 2), ...SYSTEM_TEMPLATES, ...BASE_TEMPLATES.slice(2)]

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
