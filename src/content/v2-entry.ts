import { startV2ContentScript } from "./v2.ts";

void startV2ContentScript().catch((error: unknown) => {
  console.error("FocusGate v2 content script failed to initialize.", error);
});
