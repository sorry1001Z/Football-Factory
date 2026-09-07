import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://football-factory.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Football Factory', template: '%s | Football Factory' },
  description: 'ข่าวฟุตบอล ผลบอล โปรแกรมการแข่งขัน บทวิเคราะห์ และข้อมูลทีมแบบรวดเร็ว',
  openGraph: { type: 'website', siteName: 'Football Factory', locale: 'th_TH' },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
