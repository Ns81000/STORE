import { createServerFn } from "@tanstack/react-start";
import { unlockInput } from "./store.schemas";
import { attemptUnlock, endSession, readSessionState } from "./auth.server";

export const unlockStore = createServerFn({ method: "POST" })
  .inputValidator(unlockInput.parse)
  .handler(async ({ data }) => attemptUnlock(data.password));

export const getSessionState = createServerFn({ method: "GET" }).handler(async () =>
  readSessionState(),
);

export const lockStore = createServerFn({ method: "POST" }).handler(async () => endSession());
