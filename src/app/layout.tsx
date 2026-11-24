import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "SURFACE Audit | Measurement Assurance", description: "Metrology audit and consulting workspace" };
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>}
