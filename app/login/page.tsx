import { Suspense } from "react";
import { BrandPanel } from "@/components/auth/BrandPanel";
import { AuthForm } from "@/components/auth/AuthForm";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <BrandPanel />

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* compact brand mark for small screens */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="grid h-8 w-8 place-items-center rounded-md border border-lime/40 bg-lime/10 text-lime">
              ▦
            </span>
            <span className="font-display text-xs font-bold tracking-[0.3em]">
              PIXELDRIFT
            </span>
          </div>

          <div className="mb-8">
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-faint">
              Authenticate
            </span>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">
              Sign in
            </h2>
            <p className="mt-1.5 text-sm text-text-dim">
              Welcome back. Pick up where you left off.
            </p>
          </div>

          <Suspense fallback={null}>
            <AuthForm mode="login" />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
