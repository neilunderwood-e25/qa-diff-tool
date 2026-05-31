import { redirect } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { CompareWorkspace } from "@/components/CompareWorkspace";
import { getCurrentUser } from "@/lib/supabase/server";

export default async function Home() {
  // Middleware already gates this route; re-checking here gives us the email
  // for the chrome and is a clean defense-in-depth fallback.
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      <TopBar email={user.email ?? "unknown"} />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-faint">
              Visual regression
            </span>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-text">
              Live <span className="text-text-faint">vs</span>{" "}
              <span className="text-lime">Test</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm text-text-dim">
              Paste a slug to capture full-page screenshots at desktop &amp;
              mobile across locales, and diff them pixel by pixel.
            </p>
          </div>
        </div>

        <CompareWorkspace />
      </main>
    </>
  );
}
