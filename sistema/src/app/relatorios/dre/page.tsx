"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DreRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/relatorios/financeiro");
  }, [router]);

  return (
    <div style={{ padding: "40px", textAlign: "center", fontFamily: "sans-serif" }}>
      <p>Redirecionando para o painel unificado de Financial Analysis &amp; DRE Gerencial...</p>
    </div>
  );
}
