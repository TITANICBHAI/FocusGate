import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import type { LockLevel } from "../../shared/types.ts";
import { StrictPasswordSheet } from "../components/StrictPasswordSheet.tsx";
import { createStrictAsk } from "../lib/strictStart.ts";

/**
 * The password question before a Strict session starts.
 *
 *   if (!(await strictPassword.ask(lockLevel))) return;   // cancelled: nothing changed
 *   ...start the session...
 *   {strictPassword.sheet}                                 // somewhere in the screen
 *
 * `ask` answers true at once for any other lock, so call sites stay one line.
 */
export function useStrictPassword(hasPassword: boolean): {
  ask(lockLevel: LockLevel): Promise<boolean>;
  sheet: ReactElement;
} {
  const [open, setOpen] = useState(false);
  const asker = useMemo(() => createStrictAsk(setOpen), []);

  // Leaving the screen with the question open counts as cancelling it.
  useEffect(() => () => asker.finish(false), [asker]);

  const sheet = (
    <StrictPasswordSheet
      open={open}
      hasPassword={hasPassword}
      onCancel={() => asker.finish(false)}
      onDone={() => asker.finish(true)}
    />
  );
  return { ask: asker.ask, sheet };
}
