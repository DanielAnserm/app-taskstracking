import { createBrowserRouter } from "react-router-dom";
import { DailyPage } from "../pages/DailyPage";
import { HistoryPage } from "../pages/HistoryPage";
import { HomePage } from "../pages/HomePage";
import { MonthlyPage } from "../pages/MonthlyPage";
import { OverviewPage } from "../pages/OverviewPage";
import { SettingsPage } from "../pages/SettingsPage";
import { WeeklyPage } from "../pages/WeeklyPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />,
  },
  {
    path: "/jour",
    element: <DailyPage />,
  },
  {
    path: "/hebdo",
    element: <WeeklyPage />,
  },
  {
    path: "/mensuel",
    element: <MonthlyPage />,
  },
  {
    path: "/global",
    element: <OverviewPage />,
  },
  {
    path: "/historique",
    element: <HistoryPage />,
  },
  {
    path: "/parametres",
    element: <SettingsPage />,
  },
]);