import "./globals.css";

export const metadata = {
  title: "Canary API",
  description: "REST API for the Canary error-monitoring backend.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
