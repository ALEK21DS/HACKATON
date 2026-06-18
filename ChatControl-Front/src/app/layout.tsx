import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NextLine - Chat profesional',
  description: 'Sistema de chat con WhatsApp e IA',
  icons: {
    icon: '/assets/images/NOIRLINE2.png',
    apple: '/assets/images/NOIRLINE2.png',
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
