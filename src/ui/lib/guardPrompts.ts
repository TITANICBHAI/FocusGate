export type GuardPasswordPrompt = (message: string) => Promise<string | null>;

export class GuardedStorageWriteError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "GuardedStorageWriteError";
  }
}

let activePrompt: GuardPasswordPrompt | null = null;

export function registerGuardPasswordPrompt(
  prompt: GuardPasswordPrompt,
): () => void {
  activePrompt = prompt;
  return () => {
    if (activePrompt === prompt) activePrompt = null;
  };
}

export function requestGuardPassword(message: string): Promise<string | null> {
  return activePrompt
    ? activePrompt(message)
    : Promise.resolve(null);
}

export function storageWriteErrorMessage(
  error: unknown,
  fallback: string,
): string {
  return error instanceof GuardedStorageWriteError ? error.message : fallback;
}
