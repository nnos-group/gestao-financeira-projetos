import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";
import { SecurityGuard } from "@/components/SecurityGuard";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["500", "600", "700", "800"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "NNÓS | Gestão Financeira de Projetos",
  description: "Sistema corporativo NNÓS para planejamento, gestão financeira e controle de projetos.",
  icons: {
    icon: "/logo-coruja.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('tema');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}`,
          }}
        />
        {/* Proteção Global contra F12, DevTools, Exibir Código e Clique Direito */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  document.addEventListener('contextmenu', function(e) {
                    e.preventDefault();
                    return false;
                  }, { capture: true });

                  document.addEventListener('keydown', function(e) {
                    if (e.key === 'F12' || e.keyCode === 123) {
                      e.preventDefault();
                      e.stopPropagation();
                      return false;
                    }
                    if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I','i','J','j','C','c','K','k'].includes(e.key)) {
                      e.preventDefault();
                      e.stopPropagation();
                      return false;
                    }
                    if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
                      e.preventDefault();
                      e.stopPropagation();
                      return false;
                    }
                    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
                      e.preventDefault();
                      e.stopPropagation();
                      return false;
                    }
                  }, { capture: true });
                } catch(err) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${jakarta.variable} ${inter.variable}`}>
        <SecurityGuard />
        {children}
      </body>
    </html>
  );
}
