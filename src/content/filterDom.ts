import { getSiteSelectors } from "./sites.ts";
import type { ContentSiteDefinition, KeywordTarget } from "./sites.ts";

export interface FilterHealthReport {
  hosts: readonly string[];
  missingSelectors: string[];
  invalidSelectors: string[];
}

export interface MutationBatch {
  targets: readonly Node[];
  addedNodes: readonly Node[];
}

export function inspectFilterHealth(
  documentRef: Pick<Document, "querySelectorAll">,
  site: ContentSiteDefinition,
): FilterHealthReport {
  const missingSelectors: string[] = [];
  const invalidSelectors: string[] = [];
  for (const selector of getSiteSelectors(site)) {
    try {
      if (documentRef.querySelectorAll(selector).length === 0) {
        missingSelectors.push(selector);
      }
    } catch {
      invalidSelectors.push(selector);
    }
  }
  return {
    hosts: site.hosts,
    missingSelectors,
    invalidSelectors,
  };
}

export function applyKeywordVisibility(
  documentRef: Pick<Document, "querySelectorAll">,
  target: KeywordTarget,
  hide: boolean,
  changedNodes?: MutationBatch,
): number {
  const containers = collectContainers(
    documentRef,
    target.containerSelector,
    changedNodes,
  );
  for (const container of containers) {
    const hiddenElement = target.hideSelector
      ? container.closest(target.hideSelector) ?? container
      : container;
    if (hide) {
      if (hiddenElement.getAttribute("data-fg-hidden") !== "1") {
        hiddenElement.setAttribute("data-fg-hidden", "1");
      }
    } else if (hiddenElement.getAttribute("data-fg-hidden") === "1") {
      hiddenElement.removeAttribute("data-fg-hidden");
    }
  }
  return containers.length;
}

export function collectContainers(
  documentRef: Pick<Document, "querySelectorAll">,
  selector: string,
  changedNodes?: MutationBatch,
): Element[] {
  if (!changedNodes) {
    return [...documentRef.querySelectorAll(selector)];
  }

  const containers = new Set<Element>();
  const addSelfAndAncestor = (node: Node) => {
    const element =
      node.nodeType === 1
        ? (node as Element)
        : (node.parentElement ?? undefined);
    if (!element) return undefined;
    if (element.matches(selector)) containers.add(element);
    const ancestor = element.closest(selector);
    if (ancestor) containers.add(ancestor);
    return element;
  };
  for (const node of changedNodes.targets) {
    addSelfAndAncestor(node);
  }
  for (const node of changedNodes.addedNodes) {
    const element = addSelfAndAncestor(node);
    if (!element || node.nodeType !== 1) continue;
    for (const descendant of element.querySelectorAll(selector)) {
      containers.add(descendant);
    }
  }
  return [...containers];
}

export function keywordText(
  container: Element,
  target: KeywordTarget,
): string {
  if (target.textSelectors.length === 0) return container.textContent ?? "";
  return target.textSelectors
    .flatMap((selector) => [...container.querySelectorAll(selector)])
    .map((element) => element.textContent ?? "")
    .join(" ");
}
