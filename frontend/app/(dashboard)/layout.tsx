"use client";

import React from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { useAuth } from "@/hooks/api/useAuth";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import styles from "./layout.module.css";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated } = useAuth();
  const userName = user?.name || "User";

  return (
    <ProtectedLayout>
      <div className={styles.layout}>
        <Header isAuthenticated={isAuthenticated} userName={userName} />
        <div className={styles.container}>
          <Sidebar />
          <main className={styles.main}>{children}</main>
        </div>
        <Footer />
      </div>
    </ProtectedLayout>
  );
}
