import {
  quickBlockTarget,
  type QuickBlockTarget,
} from "../shared/quickBlock.ts";

export const BLOCK_CURRENT_SITE_COMMAND = "block-current-site";

export interface QuickBlockTab {
  id: number;
  url?: string;
}

export interface QuickBlockCommandDependencies {
  getActiveTab(): Promise<QuickBlockTab | null>;
  getDestination(): Promise<"focus" | "always">;
  addSites(
    domains: string[],
    destination: "focus" | "always",
  ): Promise<void>;
  shouldRedirect(target: QuickBlockTarget): Promise<boolean>;
  redirectTab(tabId: number, url: string): Promise<void>;
}

/**
 * Staged Alt+Shift+B command handler. Register only with the v2 worker after
 * the approved WP5 cutover; the active v1 command listener is left unchanged.
 */
export function createQuickBlockCommandHandler(
  dependencies: QuickBlockCommandDependencies,
): (command: string) => Promise<boolean> {
  return async (command) => {
    if (command !== BLOCK_CURRENT_SITE_COMMAND) return false;
    const tab = await dependencies.getActiveTab();
    if (tab?.id === undefined) return true;
    const target = quickBlockTarget(tab.url);
    if (!target) return true;
    const destination = await dependencies.getDestination();
    await dependencies.addSites(target.domains, destination);
    if (await dependencies.shouldRedirect(target)) {
      await dependencies.redirectTab(tab.id, target.url);
    }
    return true;
  };
}
