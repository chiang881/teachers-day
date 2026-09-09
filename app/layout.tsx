import type { Metadata } from 'next';
import { preload } from 'react-dom';
import config from '../config';
import './globals.css';
export const metadata: Metadata = {
  title: '叩叩，老师在吗？ · 教师节快乐',
  description: '一封信，一首歌，一份来自同学们的教师节祝福。',
  icons: {
    icon: config.brand.favicon,
    shortcut: config.brand.favicon,
    apple: config.brand.favicon,
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const images = [
    ...Object.values(config.brand),
    config.music.cover,
    ...Object.values(config.artwork),
    config.gift.artwork,
  ];
  const files = [config.music.src, config.gift.model, config.video.src];
  for (const href of images)
    preload(href, { as: 'image', crossOrigin: 'anonymous' });
  for (const href of files)
    preload(href, { as: 'fetch', crossOrigin: 'anonymous' });
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
