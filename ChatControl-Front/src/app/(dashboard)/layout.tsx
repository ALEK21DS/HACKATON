import { Suspense } from 'react';
import Sidebar from '@/widgets/sidebar/ui/Sidebar';
import styles from '@/app/(dashboard)/chat/chat.module.css';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.layout}>
      <Suspense fallback={null}>
        <Sidebar />
      </Suspense>
      <Suspense fallback={null}>
        {children}
      </Suspense>
    </div>
  );
}
