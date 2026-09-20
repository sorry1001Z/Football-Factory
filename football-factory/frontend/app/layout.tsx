import type { Metadata } from 'next';
import './globals.css';
import './admin-shell.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { getSiteUrl } from '@/lib/seo/seo';
import {
  BRAND_NAME,
  BRAND_DESCRIPTION,
  BRAND_ICON_PATH,
  BRAND_TITLE_TEMPLATE,
} from '@/lib/brand';

const siteUrl = getSiteUrl();
const title = BRAND_NAME;
const description = BRAND_DESCRIPTION;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: title, template: BRAND_TITLE_TEMPLATE },
  description,
  applicationName: BRAND_NAME,
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon.png', type: 'image/png' },
      { url: BRAND_ICON_PATH, type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/favicon.png',
  },
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: BRAND_NAME,
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
