import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: '叩叩，老师在吗？ · 教师节快乐', description: '一封信，一首歌，一份来自同学们的教师节祝福。' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="zh-CN" suppressHydrationWarning><body>{children}</body></html>;
}
