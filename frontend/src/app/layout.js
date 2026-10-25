import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { DocumentsProvider } from '@/context/DocumentsContext';
import { ConversationsProvider } from '@/context/ConversationsContext';

export const metadata = {
  title: 'DocAI — AI Assistant',
  description: 'A modern ChatGPT-style AI assistant powered by Google Gemini AI.',
  viewport: 'width=device-width, initial-scale=1',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-screen relative overflow-x-hidden">

        {/* Ambient background glow blobs */}
        <div className="glow-blob glow-purple w-[700px] h-[700px] -top-48 -left-48" style={{ animationDelay: '0s' }} />
        <div className="glow-blob glow-blue   w-[600px] h-[600px] top-1/3   -right-48" style={{ animationDelay: '4s' }} />
        <div className="glow-blob glow-cyan   w-[400px] h-[400px] bottom-0  left-1/3"  style={{ animationDelay: '8s' }} />
        <div className="glow-blob glow-purple w-[350px] h-[350px] bottom-24 right-1/4" style={{ animationDelay: '2s' }} />

        <AuthProvider>
          <DocumentsProvider>
            <ConversationsProvider>
              <main className="relative z-10">{children}</main>
            </ConversationsProvider>
          </DocumentsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
