export const note = {
  name: 'note',
  title: 'Nota',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Titolo',
      type: 'string',
      validation: (Rule) => Rule.required(),
    },
    {
      name: 'body',
      title: 'Contenuto',
      type: 'array',
      of: [{ type: 'block' }, { type: 'image' }],
    },
    {
      name: 'visibility',
      title: 'Visibilità',
      type: 'string',
      options: {
        list: [
          { title: 'Personale', value: 'personal' },
          { title: 'Di Gruppo', value: 'group' },
        ],
        layout: 'radio',
      },
      initialValue: 'group',
      validation: (Rule) => Rule.required(),
    },
    {
      name: 'dmOnly',
      title: 'Visibile solo al DM',
      type: 'boolean',
      initialValue: false,
    },
    {
      name: 'canonState',
      title: 'Stato Canone',
      type: 'string',
      options: {
        list: [
          { title: 'Fatto accertato (Canon)', value: 'canon' },
          { title: 'Teoria', value: 'theory' },
          { title: 'Sconosciuto', value: 'unknown' },
        ],
      },
      initialValue: 'canon',
    },
    {
      name: 'pinned',
      title: 'Fissata (Pinned)',
      type: 'boolean',
      initialValue: false,
    },
    {
      name: 'askDm',
      title: 'Da chiedere al DM',
      type: 'boolean',
      initialValue: false,
    },
    {
      name: 'tags',
      title: 'Tag',
      type: 'array',
      of: [{ type: 'string' }],
    },
    {
      name: 'author',
      title: 'Autore (Player)',
      type: 'reference',
      to: [{ type: 'player' }],
      validation: (Rule) => Rule.required(),
    },
    {
      name: 'authorSanityId',
      title: 'ID Sanity Autore',
      type: 'string',
      description: 'Copia ridondante per check sicurezza lato UI/query',
    },
    {
      name: 'category',
      title: 'Categoria',
      type: 'reference',
      to: [{ type: 'category' }],
    },
    {
      name: 'session',
      title: 'Sessione collegata',
      type: 'reference',
      to: [{ type: 'session' }],
    },
    {
      name: 'relatedEntities',
      title: 'Entità Collegate',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'entity' }] }],
    },
    {
      name: 'coverImage',
      title: 'Immagine Copertina',
      type: 'image',
      options: { hotspot: true },
    },
  ],
};
