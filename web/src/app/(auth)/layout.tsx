import Link from "next/link";

import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background p-6">
      {/* subtle brand ambient glow behind the auth card */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 size-[32rem] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl"
      />
      <Link href="/" className="relative z-10 mb-6" aria-label="Tradynance home">
        <Logo />
      </Link>
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}
