import { Suspense } from 'react';
import Sidebar from '@/widgets/sidebar/ui/Sidebar';
import { BroadcastProgressProvider } from '@/widgets/broadcast-progress/BroadcastProgressProvider';
import styles from '@/app/(dashboard)/chat/chat.module.css';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BroadcastProgressProvider>
      <div className={styles.layout}>
        <Suspense fallback={null}>
          <Sidebar />
        </Suspense>
        <Suspense fallback={null}>
          {children}
        </Suspense>
      </div>
    </BroadcastProgressProvider>
  );
}
