// WP1 bridge: keep the existing content behavior until its v2 replacement lands in WP4.
import "../../public/content.js";

// Keep the content entrypoint tied to the shared state contract without
// activating v2 storage in the still-v1 content script.
export type { KeywordRule } from "../shared/types.ts";
