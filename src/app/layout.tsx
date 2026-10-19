import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from '@/contexts/AuthContext';
import Providers from '@/components/Providers';

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "CLARA",
  description: "Gabay sa Inyong Dokumento - Plain-language civic registry guide in the Philippines (RA 9048, Late Registration, IPRA RA 8371).",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CLARA",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fil" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Anti-FOUC script for dark/light theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const saved = localStorage.getItem('clara-theme-preference') || 'system';
                  let effectiveTheme = 'light';
                  if (saved === 'system') {
                    effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  } else {
                    effectiveTheme = saved;
                  }
                  document.documentElement.setAttribute('data-theme', effectiveTheme);
                } catch (e) {
                  console.error('Theme initialization failed:', e);
                }
              })();
            `,
          }}
        />
        {/* Meta tags for PWA mobile compliance */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--text-primary)] font-sans antialiased">
        <a href="#main-content" className="skip-link">
          Laktawan patungo sa nilalaman (Skip to content)
        </a>
        <Providers>
          <AuthProvider>
            <main id="main-content" className="flex-1 flex flex-col">
              {children}
            </main>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}