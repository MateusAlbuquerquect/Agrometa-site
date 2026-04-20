import type { Metadata } from "next";
import { AppHeader } from "@/app/components/AppHeader";

export const metadata: Metadata = {
  title: "AgroMeta",
  description: "ERP Agrícola",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f1a0f" />
        <style>{`
          :root {
            --color-bg:         #0d1a0d;
            --color-surface:    #132213;
            --color-surface-2:  #1a2e1a;
            --color-border:     #2a3e2a;
            --color-accent:     #4ade80;
            --color-accent-dim: #22c55e;
            --color-warning:    #facc15;
            --color-danger:     #f87171;
            --color-text:       #e2f5e2;
            --color-text-muted: #7da87d;
            --color-header-bg:  #0a140a;
            --font-ui:          'DM Sans', system-ui, sans-serif;
            --font-data:        'JetBrains Mono', 'Fira Code', monospace;
            --header-h:         56px;
            --radius:           8px;
            --radius-lg:        12px;
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html, body {
            background: var(--color-bg);
            color: var(--color-text);
            font-family: var(--font-ui);
            font-size: 15px;
            -webkit-font-smoothing: antialiased;
            min-height: 100dvh;
          }
          .agm-header {
            position: sticky; top: 0; z-index: 100;
            height: var(--header-h);
            background: var(--color-header-bg);
            border-bottom: 1px solid var(--color-border);
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            align-items: center;
            padding: 0 16px; gap: 8px;
          }
          .agm-logo {
            display: flex; align-items: center; gap: 8px;
            color: var(--color-accent); text-decoration: none;
            font-family: var(--font-data); font-weight: 700;
            font-size: 16px; letter-spacing: -0.5px; width: max-content;
          }
          .agm-farm-name { display: flex; justify-content: center; }
          .agm-farm-display {
            background: none; border: none; cursor: pointer;
            display: flex; align-items: center; gap: 4px;
            color: var(--color-text-muted);
            font-family: var(--font-ui); font-size: 13px; font-weight: 500;
            padding: 4px 8px; border-radius: var(--radius);
            transition: color 0.15s, background 0.15s;
            white-space: nowrap; max-width: 180px; overflow: hidden;
          }
          .agm-farm-display span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .agm-farm-display:hover { color: var(--color-text); background: var(--color-surface); }
          .agm-chevron { opacity: 0.5; flex-shrink: 0; }
          .agm-farm-edit { display: flex; align-items: center; gap: 4px; }
          .agm-farm-input {
            background: var(--color-surface); border: 1px solid var(--color-accent);
            border-radius: var(--radius); color: var(--color-text);
            font-size: 13px; padding: 4px 8px; width: 160px; outline: none;
          }
          .agm-btn-save, .agm-btn-cancel {
            background: none; border: none; cursor: pointer;
            font-size: 14px; padding: 4px 6px; border-radius: 4px;
          }
          .agm-btn-save { color: var(--color-accent); }
          .agm-btn-cancel { color: var(--color-danger); }
          .agm-header-actions { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }
          .agm-icon-btn {
            position: relative; background: none; border: none; cursor: pointer;
            color: var(--color-text-muted); padding: 8px; border-radius: var(--radius);
            display: flex; align-items: center;
            transition: color 0.15s, background 0.15s; text-decoration: none;
          }
          .agm-icon-btn:hover { color: var(--color-text); background: var(--color-surface); }
          .agm-badge {
            position: absolute; top: 4px; right: 4px;
            background: var(--color-danger); color: white;
            font-size: 10px; font-weight: 700;
            width: 16px; height: 16px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
          }
          .agm-avatar {
            width: 34px; height: 34px; border-radius: 50%;
            border: 1.5px solid var(--color-border);
            overflow: hidden; padding: 0;
            display: flex; align-items: center; justify-content: center;
          }
          .agm-avatar-img { width: 100%; height: 100%; object-fit: cover; }
          .agm-avatar-initials {
            font-family: var(--font-data); font-size: 14px; font-weight: 700;
            color: var(--color-accent);
          }
          .agm-main { min-height: calc(100dvh - var(--header-h)); padding: 0; }
          .tab-bar {
            display: flex; background: var(--color-header-bg);
            border-bottom: 1px solid var(--color-border);
            padding: 0 12px; gap: 4px; flex-shrink: 0;
          }
          .tab-btn {
            display: flex; align-items: center; gap: 6px;
            padding: 12px 16px; background: none; border: none;
            border-bottom: 2px solid transparent;
            color: var(--color-text-muted);
            font-family: var(--font-ui); font-size: 14px; font-weight: 500;
            cursor: pointer; transition: color 0.15s, border-color 0.15s;
            white-space: nowrap; margin-bottom: -1px;
          }
          .tab-btn:hover { color: var(--color-text); }
          .tab-btn--active { color: var(--color-accent); border-bottom-color: var(--color-accent); }
        `}</style>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppHeader />
        <main className="agm-main">{children}</main>
      </body>
    </html>
  );
}
