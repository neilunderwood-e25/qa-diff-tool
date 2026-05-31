import Link from "next/link";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { SettingsForm } from "@/components/SettingsForm";
import { getCurrentUser } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      <TopBar email={user.email ?? "unknown"} />

      <main className="mx-auto max-w-2xl px-6 py-10">
        <Link
          href="/"
          className="font-mono text-xs uppercase tracking-[0.12em] text-text-faint transition hover:text-text-dim"
        >
          ← Back to compare
        </Link>

        <div className="mb-8 mt-4">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-faint">
            Configuration
          </span>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-text">
            Settings
          </h1>
          <p className="mt-2 text-sm text-text-dim">
            Set the base URLs for each site. Once configured, you only paste a
            slug (e.g.{" "}
            <span className="font-mono text-text-dim">
              /customers/acens-caso-de-exito
            </span>
            ) and these prefixes are added automatically. Shared across everyone
            in the workspace.
          </p>
        </div>

        <SettingsForm />
      </main>
    </>
  );
}
