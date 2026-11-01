import "../styles.css";
import { mountUiPage } from "../mount.tsx";
import { PanelPage } from "./PanelPage.tsx";

mountUiPage(<PanelPage />, { prepareMigratedStorage: false });
