// WP1 bridge: keep the existing worker behavior until its v2 replacement lands in WP2.
// Import the shared storage layer without calling ready() while the popup still
// reads and writes v1 keys.
import "../shared/storage.ts";
import "../../public/background.js";
