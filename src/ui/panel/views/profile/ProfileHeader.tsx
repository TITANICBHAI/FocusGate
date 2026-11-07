import { User } from "lucide-react";
import { DISPLAY_NAME_MAX } from "../../../../shared/profile.ts";
import { badgeInitial } from "../../../lib/profileSummary.ts";
import { InlineText } from "./InlineText.tsx";

/** Badge with the first letter of the name, and the name itself, editable in place. */
export function ProfileHeader({
  displayName,
  onSave,
}: {
  displayName: string;
  onSave(name: string): void;
}) {
  const initial = badgeInitial(displayName);
  return (
    <div className="fg-profile-head">
      <span className="fg-badge" aria-hidden="true">
        {initial ?? <User className="fg-icon-16" />}
      </span>
      <InlineText
        id="profile-name"
        label="Your name"
        value={displayName}
        placeholder="Your name"
        maxLength={DISPLAY_NAME_MAX}
        className="fg-profile-head__name"
        onCommit={onSave}
      />
    </div>
  );
}
