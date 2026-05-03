'use client';

import Sidebar from '@/app/components/Sidebar';
import styles from '@/app/(dashboard)/chat/chat.module.css';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.layout}>
      <Sidebar />
      {children}
    </div>
  );
}
