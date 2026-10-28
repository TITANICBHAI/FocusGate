import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Button, PasswordField } from "./primitives.tsx";
import { Modal } from "./feedback.tsx";
import { registerGuardPasswordPrompt } from "../lib/guardPrompts.ts";

interface PromptRequest {
  message: string;
  resolve(password: string | null): void;
}

export function GuardPromptHost() {
  const [current, setCurrent] = useState<PromptRequest | null>(null);
  const [password, setPassword] = useState("");
  const requests = useRef<PromptRequest[]>([]);
  const active = useRef<PromptRequest | null>(null);

  const showNext = useCallback(() => {
    if (active.current) return;
    const next = requests.current.shift() ?? null;
    active.current = next;
    setCurrent(next);
    setPassword("");
  }, []);

  const prompt = useCallback(
    (message: string) =>
      new Promise<string | null>((resolve) => {
        requests.current.push({ message, resolve });
        showNext();
      }),
    [showNext],
  );

  useEffect(() => {
    const unregister = registerGuardPasswordPrompt(prompt);
    return () => {
      unregister();
      active.current?.resolve(null);
      requests.current.splice(0).forEach((request) => request.resolve(null));
      active.current = null;
    };
  }, [prompt]);

  function finish(value: string | null) {
    const request = active.current;
    if (!request) return;
    active.current = null;
    setCurrent(null);
    setPassword("");
    request.resolve(value);
    showNext();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password) finish(password);
  }

  return (
    <Modal
      open={current !== null}
      title="Verify your password"
      description={current?.message}
      onClose={() => finish(null)}
      actions={
        <>
          <Button variant="secondary" onClick={() => finish(null)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="guard-password-form"
            disabled={!password}
          >
            Continue
          </Button>
        </>
      }
    >
      <form
        id="guard-password-form"
        onSubmit={submit}
        className="fg-stack"
      >
        <PasswordField
          id="guard-current-password"
          label="Current password"
          helper="Paste is disabled for this verification field."
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          blockPaste
          autoFocus
        />
      </form>
    </Modal>
  );
}
