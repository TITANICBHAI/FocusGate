// Keep the existing content behavior active through WP4; promote the v2 entry
// only at the WP5 atomic cutover.
import "../../public/content.js";

// Keep the content entrypoint tied to the shared state contract without
// activating v2 storage in the still-v1 content script.
export type { KeywordRule } from "../shared/types.ts";
