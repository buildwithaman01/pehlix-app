import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: "Pehlix — Built for Indian Labs",
  description: "The complete operating system for diagnostic labs in India",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-satoshi bg-neutral-light text-graphite">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
