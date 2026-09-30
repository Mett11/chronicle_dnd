export const session = {
  name: 'session',
  title: 'Sessione',
  type: 'document',
  fields: [
    {
      name: 'number',
      title: 'Numero',
      type: 'number',
      validation: (Rule) => Rule.required(),
    },
    {
      name: 'date',
      title: 'Data',
      type: 'date',
      validation: (Rule) => Rule.required(),
    },
    {
      name: 'title',
      title: 'Titolo',
      type: 'string',
    },
    {
      name: 'recap',
      title: 'Recap',
      type: 'array',
      of: [{ type: 'block' }, { type: 'image' }],
    },
    {
      name: 'coverImage',
      title: 'Immagine di copertina',
      type: 'image',
      options: { hotspot: true },
    },
    {
      name: 'attendees',
      title: 'Presenti',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'player' }] }],
    },
  ],
  preview: {
    select: {
      title: 'title',
      number: 'number',
      date: 'date',
      media: 'coverImage',
    },
    prepare({ title, number, date, media }) {
      return {
        title: `Sessione ${number}${title ? `: ${title}` : ''}`,
        subtitle: date,
        media,
      }
    }
  }
};
