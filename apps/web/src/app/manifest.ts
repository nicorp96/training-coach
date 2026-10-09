import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Tempo · Training Coach',
    short_name: 'Tempo',
    start_url: '/today',
    display: 'standalone',
    background_color: '#F6F6F1',
    theme_color: '#F6F6F1',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
