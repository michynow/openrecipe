import { SiteHeader } from "@/components/site-header";

/**
 * The signed-in shell. Everything under (app) gets the header and navigation.
 *
 * (auth) deliberately has no header — a login screen should not offer links into
 * an app you have not signed into yet.
 */
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
