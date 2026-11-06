"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePerfilAcesso } from "@/contexts/PerfilAcessoContext";

export default function AtivadorVisaoLiderPage() {
  const router = useRouter();
  const { ativarPerfil, perfilAtivoObj } = usePerfilAcesso();

  useEffect(() => {
    ativarPerfil("LIDER", true);
    const destino =
      perfilAtivoObj?.id === "LIDER" &&
      perfilAtivoObj?.rotaPadrao &&
      perfilAtivoObj.rotaPadrao !== "/lider"
        ? perfilAtivoObj.rotaPadrao
        : "/projetos";
    router.replace(destino);
  }, [ativarPerfil, perfilAtivoObj, router]);

  return null;
}
