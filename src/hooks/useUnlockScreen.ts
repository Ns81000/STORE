import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getSessionState, unlockStore } from "@/lib/auth.functions";

function formatWait(ms: number): string {
  const minutes = Math.ceil(ms / 60000);
  return minutes <= 1 ? "a minute" : `${minutes} minutes`;
}

/**
 * Shared behaviour for both lock screens: session-redirect on mount, unlock
 * submission, error/shake feedback, and the curtain-wipe handoff to /home.
 */
export function useUnlockScreen() {
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
    let unlocked = false;
    try {
      const result = await unlock({ data: { password } });
      if (result.ok) {
        // Curtain wipe carries the eye from lock screen into the vault; the
        // button stays disabled through it so a double-click can't re-fire.
        unlocked = true;
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
    } catch {
      setError("Couldn't reach the vault — check your connection.");
      setShake((value) => value + 1);
    } finally {
      if (!unlocked) setPending(false);
    }
  };

  return { password, setPassword, pending, revealing, error, shake, submit };
}
