import "../styles.css";
import { DashboardPage } from "./DashboardPage.tsx";
import { mountUiPage } from "../mount.tsx";

mountUiPage(<DashboardPage />, { prepareMigratedStorage: false });
