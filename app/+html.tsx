import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

// Apenas web: acompanha a área visível quando as barras do navegador mudam de tamanho.
export default function RootHtml({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#087b55" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="KATUÁ" />
        <link rel="apple-touch-icon" href="/pwa-192.png" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: `
          #root { min-height: 0; }
          @supports (height: 100dvh) {
            html, body, #root { height: 100dvh; }
          }
        ` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
