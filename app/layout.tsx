import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'Trading MVP',
  description: 'Paper trading MVP with live widgets',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial' }}>
        <nav
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 50,
            background: '#0b0e11',
            borderBottom: '1px solid #222',
            padding: '12px 16px',
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
          }}
        >
          <span style={{ color: 'white', fontWeight: 700, marginRight: 8 }}>Trading MVP</span>

          <Link href="/trade" style={linkStyle}>
            Trade
          </Link>
          <Link href="/mining" style={linkStyle}>
            Mining
          </Link>
          <Link href="/settings" style={linkStyle}>
            Settings
          </Link>
        </nav>

        <main>{children}</main>
      </body>
    </html>
  );
}

const linkStyle: React.CSSProperties = {
  color: '#cbd5e1',
  textDecoration: 'none',
  padding: '6px 10px',
  borderRadius: 8,
  background: '#111',
};