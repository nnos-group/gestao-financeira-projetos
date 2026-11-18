import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  COOKIE_SESSION_NAME,
  obterRotaPadraoPerfil,
  verificarTokenSessao,
} from "@/lib/session-token";

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_SESSION_NAME)?.value;
  const sessao = await verificarTokenSessao(token);

  if (!sessao) {
    redirect("/login");
  }

  redirect(obterRotaPadraoPerfil(sessao.perfilId));
}
