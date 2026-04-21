import { createBrowserRouter } from "react-router-dom";
import { DailyPage } from "../pages/DailyPage";
import { HistoryPage } from "../pages/HistoryPage";
import { HomePage } from "../pages/HomePage";
import { SettingsPage } from "../pages/SettingsPage";

export const router = createBrowserRouter([
  { path: "/", element: <HomePage /> },
  { path: "/jour", element: <DailyPage /> },
  { path: "/historique", element: <HistoryPage /> },
  { path: "/parametres", element: <SettingsPage /> },
]);