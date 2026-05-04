import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type PageKey =
  | "accueil"
  | "jour"
  | "hebdo"
  | "mensuel"
  | "global"
  | "parametres"
  | "historique";

interface PageHeaderNavProps {
  currentPage: PageKey;
  title?: string;
  subtitle?: string;
  rightSlot?: ReactNode;
}

const navItems: Array<{ key: PageKey; label: string; to: string }> = [
  { key: "accueil", label: "Accueil", to: "/" },
  { key: "jour", label: "Jour", to: "/jour" },
  { key: "hebdo", label: "Hebdo", to: "/hebdo" },
  { key: "mensuel", label: "Mensuel", to: "/mensuel" },
  { key: "global", label: "Global", to: "/global" },
  { key: "parametres", label: "Paramètres", to: "/parametres" },
  { key: "historique", label: "Historique", to: "/historique" },
];

export default function PageHeaderNav({
  currentPage,
  title = "Suivi du temps",
  subtitle,
  rightSlot,
}: PageHeaderNavProps) {
  return (
    <header className="mb-6 rounded-[28px] bg-white px-5 py-4 shadow-sm ring-1 ring-black/5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 md:text-3xl">
            {title}
          </h1>

          {subtitle ? (
            <p className="mt-1 max-w-3xl text-sm text-neutral-600">
              {subtitle}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-end">
          <nav className="rounded-full bg-neutral-50 p-1 ring-1 ring-neutral-200">
            <div className="flex flex-wrap gap-1">
              {navItems.map((item) => {
                const isActive = item.key === currentPage;

                return (
                  <Link
                    key={item.key}
                    to={item.to}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition md:px-4 md:py-2 md:text-sm ${
                      isActive
                        ? "bg-neutral-900 text-white shadow-sm"
                        : "text-neutral-700 hover:bg-white hover:shadow-sm"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>

          {rightSlot ? (
            <div className="rounded-2xl bg-neutral-50 px-3 py-2 ring-1 ring-neutral-200 xl:ml-2">
              <div className="flex flex-wrap items-center gap-2">
                {rightSlot}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}