import "../styles.css";
import { OnboardingPage } from "./OnboardingPage.tsx";
import { mountUiPage } from "../mount.tsx";

mountUiPage(<OnboardingPage />, { prepareMigratedStorage: false });
