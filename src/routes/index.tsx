import { createFileRoute, redirect } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { getSessionState } from "@/lib/auth.functions";
import { GradientWaves } from "@/components/store/GradientWaves";
import { PasswordInput } from "@/components/store/primitives";
import { useUnlockScreen } from "@/hooks/useUnlockScreen";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "STORE — Private link vault" },
      { name: "description", content: "A password-protected vault for links, files and tools." },
      { property: "og:title", content: "STORE — Private link vault" },
      {
        property: "og:description",
        content: "A password-protected vault for links, files and tools.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  beforeLoad: async () => {
    const state = await getSessionState();
    if (state.unlocked) throw redirect({ to: "/home" });
  },
  component: LockScreen,
});

function LockScreen() {
  const { password, setPassword, pending, revealing, error, shake, submit } = useUnlockScreen();

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6">
      <GradientWaves
        className="fixed inset-0 -z-10"
        horizonColor="#07080a"
        waveColor="#4a1a1f"
        crestColor="#ff6161"
        speed={0.32}
        amplitude={2.2}
        brightness={1.6}
        opacity={1}
        grain
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-canvas/50 via-transparent to-canvas/90"
      />

      <div className="stagger-in w-full max-w-sm">
        <div className="flex flex-col items-center">
          <h1 className="type-display-xl text-center">STORE</h1>
          <p className="type-caption mt-3 text-center">Everything you meant to come back to.</p>
        </div>

        <form onSubmit={submit} className="mt-9 flex flex-col gap-3">
          <div key={shake} className={error ? "animate-shake" : undefined}>
            <PasswordInput
              value={password}
              autoFocus
              autoComplete="current-password"
              placeholder="Password"
              invalid={Boolean(error)}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <p className="type-caption min-h-5 text-center text-error" role="status">
            {error}
          </p>
          <button
            type="submit"
            disabled={pending || password.length === 0}
            className="press focus-ring inline-flex h-14 items-center justify-center gap-2 rounded-lg bg-accent text-base font-semibold text-on-accent elev-2 transition-[filter,opacity] duration-200 hover:brightness-110 disabled:opacity-40"
          >
            {pending ? "Unlocking…" : "Unlock"}
            {!pending ? <ArrowRight size={18} /> : null}
          </button>
        </form>
      </div>

      {revealing ? (
        <div
          aria-hidden
          className="fixed inset-0 z-[100] origin-bottom bg-canvas"
          style={{ animation: "store-curtain 420ms var(--ease-in-out-strong) both" }}
        />
      ) : null}
    </main>
  );
}
