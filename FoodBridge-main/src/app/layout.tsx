import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FoodBridge | AI-Powered Real-Time Food Redistribution Network',
  description: 'Open-source real-time food donation platform connecting Donors, NGOs/Shelters, Volunteers, and Admins with PostGIS matching, OpenCV visual spoilage inspection, and TSP route optimization.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
        {children}
      </body>
    </html>
  );
}
