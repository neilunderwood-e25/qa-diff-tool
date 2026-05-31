"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Mode = "login" | "register";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("error") === "confirm"
      ? "That confirmation link is invalid or expired. Try signing in."
      : null
  );
  const [checkEmail, setCheckEmail] = useState(false);

  const isLogin = mode === "login";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (mode === "register" && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const supabase = createSupabaseBrowserClient();

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          setError(error.message);
          return;
        }
        router.replace(next);
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(
              next
            )}`,
          },
        });
        if (error) {
          setError(error.message);
          return;
        }
        // If email confirmation is disabled in the project, signUp returns a
        // live session and we can go straight in. Otherwise prompt to confirm.
        if (data.session) {
          router.replace(next);
          router.refresh();
        } else {
          setCheckEmail(true);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (checkEmail) {
    return (
      <div className="rise text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-lime/40 bg-lime/10 text-lime">
          ✓
        </div>
        <h2 className="mt-5 font-display text-xl font-semibold tracking-tight">
          Confirm your email
        </h2>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-text-dim">
          We sent a verification link to{" "}
          <span className="font-mono text-text">{email}</span>. Open it to
          activate your account, then sign in.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm font-medium text-lime hover:underline"
        >
          ← Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rise space-y-5">
      <div className="space-y-1.5">
        <label className="block font-mono text-[11px] uppercase tracking-[0.18em] text-text-faint">
          Email
        </label>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@eight25media.com"
          className="field w-full px-3.5 py-2.5 font-mono text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="block font-mono text-[11px] uppercase tracking-[0.18em] text-text-faint">
            Password
          </label>
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-faint transition hover:text-text-dim"
          >
            {show ? "hide" : "show"}
          </button>
        </div>
        <input
          type={show ? "text" : "password"}
          autoComplete={isLogin ? "current-password" : "new-password"}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={isLogin ? "••••••••" : "8+ characters"}
          className="field w-full px-3.5 py-2.5 font-mono text-sm"
        />
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-red/30 bg-red/10 px-3 py-2.5 text-sm text-red">
          <span aria-hidden className="mt-0.5 font-mono">
            !
          </span>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-lime flex w-full items-center justify-center gap-2 px-5 py-3 text-sm"
      >
        {loading
          ? isLogin
            ? "Signing in…"
            : "Creating account…"
          : isLogin
            ? "Sign in →"
            : "Create account →"}
      </button>

      <p className="text-center text-sm text-text-dim">
        {isLogin ? (
          <>
            No account yet?{" "}
            <Link
              href="/register"
              className="font-medium text-lime hover:underline"
            >
              Create one
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-lime hover:underline"
            >
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
