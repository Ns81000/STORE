import { createFileRoute, redirect } from "@tanstack/react-router";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { getSessionState } from "@/lib/auth.functions";
import { Lightfall } from "@/components/store/Lightfall";
import { PasswordInput } from "@/components/store/primitives";
import { useUnlockScreen } from "@/hooks/useUnlockScreen";

export const Route = createFileRoute("/unlock")({
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
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-canvas px-5 py-8 sm:px-8">
      <Lightfall
        className="pointer-events-none fixed inset-0 -z-30 opacity-90"
        colors={["#ff6161", "#57c1ff", "#d78bff"]}
        backgroundColor="#07080a"
        speed={0.38}
        streakCount={4}
        streakWidth={0.78}
        streakLength={1.35}
        glow={0.72}
        density={0.52}
        twinkle={0.68}
        zoom={3.35}
        backgroundGlow={0.28}
        opacity={0.62}
        mouseStrength={0.28}
        mouseRadius={1}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-20 bg-[radial-gradient(circle_at_50%_8%,rgb(255_97_97_/_0.18),transparent_30%),radial-gradient(circle_at_82%_18%,rgb(87_193_255_/_0.12),transparent_28%),linear-gradient(180deg,rgb(7_8_10_/_0.24),rgb(7_8_10_/_0.84)_62%,#07080a)]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(to_right,rgb(255_255_255_/_0.022)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255_/_0.022)_1px,transparent_1px)] bg-[size:48px_48px] opacity-35 [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 -z-10 h-1/3 bg-gradient-to-t from-canvas to-transparent"
      />

      <section className="stagger-in grid w-full max-w-6xl items-center gap-10 pb-[max(0px,env(safe-area-inset-bottom))] pt-[max(0px,env(safe-area-inset-top))] md:grid-cols-[minmax(0,1fr)_minmax(320px,390px)] md:gap-14 lg:gap-20">
        <div className="mx-auto flex w-full max-w-xl flex-col items-center text-center md:items-start md:text-left">
          <div className="relative">
            <div
              aria-hidden
              className="absolute inset-[-22%] rounded-[28%] bg-accent/20 blur-3xl"
            />
            <img
              src="/store-icon-bg.svg"
              alt="STORE"
              className="relative h-24 w-24 rounded-[22px] shadow-[0_22px_70px_-28px_rgb(255_97_97_/_0.78)] sm:h-28 sm:w-28 md:h-32 md:w-32"
            />
          </div>

          <div className="mt-8 flex items-center gap-2 rounded-pill border border-hairline bg-surface/60 px-3 py-1.5 text-ink-subtle backdrop-blur-xl">
            <ShieldCheck size={14} className="text-accent" />
            <span className="type-label normal-case tracking-[0.04em] text-ink-subtle">
              Private link vault
            </span>
          </div>

          <h1 className="mt-5 text-[clamp(3.25rem,13vw,7.5rem)] font-semibold leading-[0.88] tracking-[-0.04em] text-ink md:text-[clamp(5rem,9vw,8rem)]">
            STORE
          </h1>
          <p className="mt-5 text-[clamp(1.4rem,5.5vw,2.35rem)] font-medium leading-tight tracking-[-0.018em] text-ink">
            Keep it close.
          </p>
          <p className="type-body mt-4 max-w-md text-pretty text-ink-subtle">
            A calm, password-protected place for the links, files, and tools you want one touch
            away.
          </p>
        </div>

        <div className="mx-auto w-full max-w-sm md:mx-0">
          <form
            onSubmit={submit}
            className="relative overflow-hidden rounded-2xl border border-hairline bg-surface/72 p-3 shadow-[0_24px_80px_-44px_rgb(0_0_0_/_0.95)] backdrop-blur-2xl sm:p-4"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-accent/70 to-transparent"
            />
            <div className="rounded-xl bg-surface-2/64 p-4 hairline-soft sm:p-5">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent hairline-soft">
                  <LockKeyhole size={18} />
                </div>
                <div className="min-w-0">
                  <h2 className="type-title-sm text-ink">Unlock STORE</h2>
                  <p className="type-caption mt-0.5">Your vault stays local to this gate.</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
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
                  {pending ? "Unlocking..." : "Unlock vault"}
                  {!pending ? <ArrowRight size={18} /> : null}
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>

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
