import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ChatControl - Chat profesional',
  description: 'Sistema de chat con WhatsApp e IA',
  icons: {
    icon: '/assets/images/logo-mensaje.png',
    apple: '/assets/images/logo-mensaje.png',
  },
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
