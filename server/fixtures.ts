import type { Direction, Segment } from '../src/types.ts'

/**
 * Datos falsos de la Etapa 2.
 *
 * Aquí está "todo" lo que puede devolver el servidor. La función `translate` recorta
 * campos según el modo, que es justo lo que hará la IA en la Etapa 3: pedirle siempre
 * lo mismo y quedarse con la parte que toca.
 *
 * Cuando llegue la IA de verdad, este archivo desaparece.
 */
export type Fixture = {
  translation: string
  segments: Segment[]
  grammar: string
}

export const FIXTURES: Record<Direction, Fixture> = {
  'ja-to-es': {
    translation: 'Voy a la escuela.',
    segments: [
      { text: '学校', reading: 'がっこう', meaning: 'escuela' },
      { text: 'に', meaning: 'partícula que marca el destino' },
      { text: '行きます', reading: 'いきます', meaning: 'ir (forma educada)' },
      { text: '。' },
    ],
    grammar:
      'La estructura es [lugar] に [verbo]. En japonés el verbo va siempre al final, ' +
      'así que 行きます cierra la frase. La partícula に marca el destino del movimiento ' +
      '(la escuela) y 行きます es la forma educada de 行く, "ir", que sirve tanto para ' +
      'presente como para futuro.',
  },
  'es-to-ja': {
    translation: '学校に行きます。',
    segments: [
      { text: '学校', reading: 'がっこう', meaning: 'escuela' },
      { text: 'に', meaning: 'partícula que marca el destino' },
      { text: '行きます', reading: 'いきます', meaning: 'ir (forma educada)' },
      { text: '。' },
    ],
    grammar:
      'El español coloca el verbo después del sujeto; el japonés lo manda al final: ' +
      '[lugar] に [verbo]. La partícula に equivale a "a" cuando indica destino, y ' +
      '行きます es la forma educada de 行く, "ir". No hace falta sujeto: se sobreentiende.',
  },
}
