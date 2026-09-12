import type { Metadata } from 'next';
import './globals.css';
import './admin-shell.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { getSiteUrl } from '@/lib/seo/seo';

const siteUrl = getSiteUrl();
const title = 'Football Factory';
const description =
  'ข่าวฟุตบอล ผลบอล โปรแกรมการแข่งขัน บทวิเคราะห์ และข้อมูลทีมแบบรวดเร็ว';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: title, template: '%s · Football Factory' },
  description,
  applicationName: 'Football Factory',
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: 'Football Factory',
    locale: 'th_TH',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title,
    description,
  },
  alternates: { canonical: '/' },
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
