import { useState } from "react";
import type { AppState, BlockPreset } from "../../shared/types.ts";
import { BUILT_IN_PRESETS } from "../../shared/presets.ts";
import { normalizeDomain } from "../../shared/domains.ts";
import { Button, Card, Field } from "../components/primitives.tsx";
import { useToast } from "../components/feedback.tsx";
import { uiStorageStore } from "../hooks/storageStore.ts";
import { storageWriteErrorMessage } from "../lib/guardPrompts.ts";

export function PresetManager({
  state,
  destination,
}: {
  state: AppState;
  destination: "focus" | "always";
}) {
  const showToast = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📌");
  const [domainsText, setDomainsText] = useState("");
  const presets = [...BUILT_IN_PRESETS, ...state.customPresets];

  function beginEdit(preset?: BlockPreset) {
    setEditingId(preset?.id ?? null);
    setName(preset?.name ?? "");
    setEmoji(preset?.emoji ?? "📌");
    setDomainsText(preset?.domains.join(", ") ?? "");
  }

  async function saveCustomPreset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      showToast("Give this preset a name.", "error");
      return;
    }
    const inputs = domainsText.split(/[,\n]/).map((entry) => entry.trim()).filter(Boolean);
    const normalized = inputs.map(normalizeDomain);
    const invalid = inputs.filter((_, index) => normalized[index] === null);
    const cleanDomains = [...new Set(
      normalized.filter((domain): domain is string => domain !== null),
    )];
    if (invalid.length || cleanDomains.length === 0) {
      showToast(
        invalid.length
          ? `Check these domains: ${invalid.join(", ")}.`
          : "Add at least one valid domain.",
        "error",
      );
      return;
    }
    const preset: BlockPreset = {
      id: editingId ?? crypto.randomUUID(),
      name: cleanName.slice(0, 60),
      emoji: emoji.trim().slice(0, 8) || "📌",
      domains: cleanDomains,
      builtIn: false,
    };
    try {
      await uiStorageStore.set("customPresets", (latest) =>
        editingId
          ? latest.map((item) => (item.id === editingId ? preset : item))
          : [...latest, preset],
      );
      setSelected((current) =>
        current.includes(preset.id) ? current : [...current, preset.id],
      );
      beginEdit();
      showToast(editingId ? "Preset updated." : "Preset saved.", "success");
    } catch (error) {
      showToast(storageWriteErrorMessage(error, "The preset could not be saved."), "error");
    }
  }

  async function removeCustomPreset(preset: BlockPreset) {
    try {
      await uiStorageStore.set("customPresets", (latest) =>
        latest.filter((item) => item.id !== preset.id),
      );
      setSelected((current) => current.filter((id) => id !== preset.id));
      if (editingId === preset.id) beginEdit();
      showToast("Preset removed.", "success");
    } catch (error) {
      showToast(storageWriteErrorMessage(error, "The preset could not be removed."), "error");
    }
  }

  async function addSelected() {
    const domains = [...new Set(
      presets
        .filter((preset) => selected.includes(preset.id))
        .flatMap((preset) => preset.domains),
    )];
    if (domains.length === 0) return;
    const key = destination === "always" ? "alwaysBlockedSites" : "blockedSites";
    try {
      await uiStorageStore.set(key, (latest) => [...new Set([...latest, ...domains])]);
      showToast(
        `Added ${domains.length} site${domains.length === 1 ? "" : "s"} to ${
          destination === "always" ? "Always" : "Focus"
        }.`,
        "success",
      );
    } catch (error) {
      showToast(storageWriteErrorMessage(error, "The selected sites could not be added."), "error");
    }
  }

  return (
    <Card
      title="Presets"
      description="Choose presets, then confirm before adding their sites."
    >
      <div className="fg-stack">
        <div className="fg-onboarding__presets">
          {presets.map((preset) => (
            <div className="fg-onboarding__preset" key={preset.id}>
              <input
                id={`preset-${preset.id}`}
                type="checkbox"
                checked={selected.includes(preset.id)}
                onChange={() =>
                  setSelected((current) =>
                    current.includes(preset.id)
                      ? current.filter((id) => id !== preset.id)
                      : [...current, preset.id],
                  )
                }
              />
              <label htmlFor={`preset-${preset.id}`}>
                <strong>{preset.emoji} {preset.name}</strong>
                <span className="fg-muted">
                  {preset.domains.length} sites · {preset.domains.slice(0, 3).join(", ")}
                </span>
              </label>
              {!preset.builtIn && (
                <span className="fg-wrap">
                  <Button
                    variant="quiet"
                    aria-label={`Edit ${preset.name}`}
                    onClick={(event) => {
                      event.preventDefault();
                      beginEdit(preset);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="quiet"
                    aria-label={`Remove ${preset.name}`}
                    onClick={(event) => {
                      event.preventDefault();
                      void removeCustomPreset(preset);
                    }}
                  >
                    Remove
                  </Button>
                </span>
              )}
            </div>
          ))}
        </div>
        <Button
          variant="secondary"
          disabled={selected.length === 0}
          onClick={() => void addSelected()}
        >
          Add selected
        </Button>
        <form className="fg-stack" onSubmit={(event) => void saveCustomPreset(event)}>
          <h3>{editingId ? "Edit custom preset" : "Create custom preset"}</h3>
          <div className="fg-grid-two">
            <Field id="custom-preset-name" label="Name">
              <input
                id="custom-preset-name"
                value={name}
                maxLength={60}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </Field>
            <Field id="custom-preset-emoji" label="Emoji">
              <input
                id="custom-preset-emoji"
                value={emoji}
                maxLength={8}
                onChange={(event) => setEmoji(event.target.value)}
              />
            </Field>
          </div>
          <Field
            id="custom-preset-domains"
            label="Domains"
            helper="Separate domains with commas or new lines."
          >
            <textarea
              id="custom-preset-domains"
              value={domainsText}
              maxLength={2_000}
              onChange={(event) => setDomainsText(event.target.value)}
              required
            />
          </Field>
          <div className="fg-wrap">
            <Button type="submit">{editingId ? "Save preset" : "Create preset"}</Button>
            {editingId && (
              <Button variant="quiet" onClick={() => beginEdit()}>
                Cancel editing
              </Button>
            )}
          </div>
        </form>
      </div>
    </Card>
  );
}
