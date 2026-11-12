/**
 * Said in the stop dialog, before anyone confirms. A session stopped early
 * still adds its minutes to focused time, but those minutes are left out of
 * the daily goal, the goal ring, the focus score and the streak.
 */
export const STOP_EARLY_NOTICE =
  "Minutes before you stop show as focused time, but they don’t count toward today’s goal or your streak.";
