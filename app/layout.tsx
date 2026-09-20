import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const title = "goodfirstrepos — is this repo worth contributing to?";
const description =
  "Paste a GitHub repository and see what actually happens to outside pull requests: merge rate, reply times, backlog rot, and a contributing score out of 100.";

export const metadata: Metadata = {
  title: { default: title, template: "%s — goodfirstrepos" },
  description,
  applicationName: "goodfirstrepos",
  keywords: ["open source", "github", "pull requests", "contributing", "maintainers", "oss"],
  openGraph: { title, description, type: "website", siteName: "goodfirstrepos" },
  twitter: { card: "summary_large_image", title, description },
  icons: {
    icon: [
      {
        url:
          "data:image/svg+xml," +
          encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#D97757"/><path d="M9 21.5V10.5h5.4c2.4 0 4 1.3 4 3.4 0 2.2-1.6 3.5-4 3.5H11.6v4.1H9Zm2.6-6.1h2.5c1.1 0 1.8-.5 1.8-1.5s-.7-1.5-1.8-1.5h-2.5v3ZM20 21.5v-11h2.6v8.8H27v2.2h-7Z" fill="#fff"/></svg>',
          ),
        type: "image/svg+xml",
      },
    ],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">{children}</body>
    </html>
  );
}
