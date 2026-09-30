export const entity = {
  name: 'entity',
  title: 'Entità',
  type: 'document',
  fields: [
    {
      name: 'type',
      title: 'Tipo',
      type: 'string',
      options: {
        list: [
          { title: 'NPC', value: 'npc' },
          { title: 'Mostro', value: 'monster' },
          { title: 'Luogo', value: 'place' },
          { title: 'Oggetto', value: 'item' },
          { title: 'Fazione', value: 'faction' },
          { title: 'Quest', value: 'quest' },
        ],
      },
      validation: (Rule) => Rule.required(),
    },
    {
      name: 'name',
      title: 'Nome',
      type: 'string',
      validation: (Rule) => Rule.required(),
    },
    {
      name: 'aliases',
      title: 'Alias (altri nomi)',
      type: 'array',
      of: [{ type: 'string' }],
    },
    {
      name: 'status',
      title: 'Stato',
      type: 'string',
      options: {
        list: [
          { title: 'Vivo', value: 'alive' },
          { title: 'Morto', value: 'dead' },
          { title: 'Sconosciuto', value: 'unknown' },
          { title: 'Distrutto/Perso', value: 'destroyed' },
          { title: 'Aperta (Quest)', value: 'open' },
          { title: 'Completata (Quest)', value: 'completed' },
          { title: 'Fallita (Quest)', value: 'failed' },
        ],
      },
      initialValue: 'unknown',
    },
    {
      name: 'body',
      title: 'Descrizione (Body)',
      type: 'array',
      of: [{ type: 'block' }, { type: 'image' }],
    },
    {
      name: 'progressNote',
      title: 'Nota Progresso (solo Quest)',
      type: 'text',
      hidden: ({ document }) => document?.type !== 'quest',
    },
    {
      name: 'images',
      title: 'Galleria Immagini',
      type: 'array',
      of: [{ type: 'image', options: { hotspot: true } }],
    },
    {
      name: 'color',
      title: 'Colore (Hex)',
      type: 'string',
    },
  ],
};
