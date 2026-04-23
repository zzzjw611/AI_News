import type { Metadata } from 'next';
import 'react-day-picker/style.css';
import './globals.css';
import { LanguageProvider } from '@/lib/LanguageContext';

export const metadata: Metadata = {
  title: 'AI Marketer Daily',
  description: 'Daily intelligence brief for AI marketers — curated and bilingual.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap"
        />
      </head>
      <body>
        <LanguageProvider>
          <div className="page-wrap">
            <div className="je">{children}</div>
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}
