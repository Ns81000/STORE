import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { getSessionState, unlockStore } from "@/lib/auth.functions";
import { GradientWaves } from "@/components/store/GradientWaves";
import { PasswordInput } from "@/components/store/primitives";

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
  component: LockScreen,
});

function formatWait(ms: number): string {
  const minutes = Math.ceil(ms / 60000);
  return minutes <= 1 ? "a minute" : `${minutes} minutes`;
}

function LockScreen() {
  const navigate = useNavigate();
  const unlock = useServerFn(unlockStore);
  const session = useServerFn(getSessionState);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);

  useEffect(() => {
    let active = true;
    void session().then((state) => {
      if (active && state.unlocked) void navigate({ to: "/home" });
    });
    return () => {
      active = false;
    };
  }, [session, navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending || password.length === 0) return;
    setPending(true);
    setError(null);
    try {
      const result = await unlock({ data: { password } });
      if (result.ok) {
        // Curtain wipe carries the eye from lock screen into the vault.
        setRevealing(true);
        window.setTimeout(() => void navigate({ to: "/home" }), 420);
        return;
      }
      setError(
        result.lockedForMs > 0
          ? `Too many attempts. Try again in ${formatWait(result.lockedForMs)}.`
          : "Incorrect password",
      );
      setShake((value) => value + 1);
      setPassword("");
    } finally {
      setPending(false);
    }
  };

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
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-canvas/50 via-transparent to-canvas/90" />

      <div className="stagger-in w-full max-w-sm">
        <div className="flex flex-col items-center">
          <h1 className="type-display-xl text-center">STORE</h1>
          <p className="type-caption mt-3 text-center">
            Everything you meant to come back to.
          </p>
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
