import { WHY_MAX } from "../../../../shared/profile.ts";
import { InlineText } from "./InlineText.tsx";

export function ReasonSection({
  why,
  onSave,
}: {
  why: string;
  onSave(reason: string): void;
}) {
  return (
    <section className="fg-profile-group" aria-labelledby="profile-reason-title">
      <h3 id="profile-reason-title" className="fg-card__title">
        Your reason
      </h3>
      <InlineText
        id="profile-why"
        label="Your reason"
        value={why}
        placeholder="Why are you doing this?"
        maxLength={WHY_MAX}
        multiline
        onCommit={onSave}
      />
      <p className="fg-field__helper">Shown on the block page.</p>
    </section>
  );
}
