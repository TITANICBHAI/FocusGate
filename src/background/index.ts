// Keep the existing worker behavior active through WP4; promote the v2 worker
// only at the WP5 atomic cutover. Do not call ready() while any v1 consumer remains.
import "../shared/storage.ts";
import "../../public/background.js";
