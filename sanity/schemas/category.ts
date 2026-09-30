export const category = {
  name: 'category',
  title: 'Categoria',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Titolo',
      type: 'string',
      validation: (Rule) => Rule.required(),
    },
    {
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title' },
      validation: (Rule) => Rule.required(),
    },
    {
      name: 'icon',
      title: 'Icona (Lucide nome)',
      type: 'string',
    },
    {
      name: 'color',
      title: 'Colore (Hex)',
      type: 'string',
    },
    {
      name: 'sortOrder',
      title: 'Ordine ordinamento',
      type: 'number',
      initialValue: 0,
    },
    {
      name: 'archived',
      title: 'Archiviato',
      type: 'boolean',
      initialValue: false,
    },
    {
      name: 'defaultTemplate',
      title: 'Template nota (Markdown)',
      type: 'text',
      description: 'Testo markdown inserito di default nelle nuove note di questa categoria',
    },
  ],
};
