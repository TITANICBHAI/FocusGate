import { PasswordReveal } from "../components/PasswordPicker.tsx";
import { Button, Card } from "../components/primitives.tsx";

/**
 * The last screen of setup. A password that was generated is shown once more here,
 * while the person is still looking at the screen, so it can be written down.
 */
export function SetupDone({
  siteCount,
  dailyGoalMin,
  generatedPassword,
  message,
  onOpenPanel,
}: {
  siteCount: number;
  dailyGoalMin: number;
  /** The password to show again, or null when none was generated. */
  generatedPassword: string | null;
  message: string;
  onOpenPanel(): void;
}) {
  const added =
    siteCount === 1
      ? "1 site was added to your Focus list."
      : `${siteCount} sites were added to your Focus list.`;
  return (
    <section className="fg-stack" aria-labelledby="onboarding-done">
      <h1 id="onboarding-done">Your setup is saved</h1>
      <p className="fg-muted">{`${added} Your daily goal is ${dailyGoalMin} minutes.`}</p>
      {generatedPassword !== null && (
        <Card title="Write your password down">
          <PasswordReveal label="Your password" password={generatedPassword} />
          <p className="fg-muted">
            Keep it where you can find it. FocusGate keeps only a scrambled copy, so it will not
            show this password again.
          </p>
        </Card>
      )}
      <Card title="What happens next">
        <p className="fg-muted">
          Open the FocusGate side panel to start a focus session. Blocking depends on your
          configured rules and browser permissions.
        </p>
      </Card>
      <div className="fg-onboard-actions">
        <Button wide variant="primary" onClick={onOpenPanel}>
          Open FocusGate in the side panel
        </Button>
      </div>
      {message && (
        <p className="fg-muted" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
