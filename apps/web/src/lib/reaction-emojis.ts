// ASYGNUZ: mismo set fijo que valida el backend (activity/schema.ts) -- se
// duplica aquí en vez de compartir el módulo porque api/web no comparten
// paquete de constantes de dominio (mismo patrón que ya sigue, por ejemplo,
// la lista de prioridades).
export const REACTION_EMOJIS = ["👍", "❤️", "😂", "🎉", "👀", "🚀"] as const;

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];
