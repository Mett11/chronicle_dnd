export const player = {
  name: 'player',
  title: 'Player',
  type: 'document',
  fields: [
    {
      name: 'characterName',
      title: 'Nome Personaggio',
      type: 'string',
      validation: (Rule) => Rule.required(),
    },
    {
      name: 'email',
      title: 'Email',
      type: 'string',
    },
    {
      name: 'sanityUserId',
      title: 'Sanity User ID',
      type: 'string',
      description: 'ID utente di Sanity, popolato automaticamente al primo login',
    },
    {
      name: 'isDm',
      title: 'Dungeon Master',
      type: 'boolean',
      initialValue: false,
    },
    {
      name: 'color',
      title: 'Colore (Hex)',
      type: 'string',
    },
    {
      name: 'aliases',
      title: 'Alias (altri nomi)',
      type: 'array',
      of: [{ type: 'string' }],
    },
    {
      name: 'avatar',
      title: 'Avatar',
      type: 'image',
      options: { hotspot: true },
    },
    {
      name: 'archived',
      title: 'Archiviato',
      type: 'boolean',
      initialValue: false,
    },
  ],
};
