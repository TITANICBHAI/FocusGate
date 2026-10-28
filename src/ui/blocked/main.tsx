import "../styles.css";
import { BlockedPage } from "./BlockedPage.tsx";
import { mountUiPage } from "../mount.tsx";

mountUiPage(<BlockedPage />, { prepareMigratedStorage: false });
