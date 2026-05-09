import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Wallet, ShoppingCart, Receipt, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CommandPalette } from "@/components/CommandPalette";
import { NotificationsBell } from "@/components/NotificationsBell";
import { usePermissions } from "@/hooks/usePermissions";

export function AppHeader() {
  const navigate = useNavigate();
  const perms = usePermissions();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header className="hidden md:flex sticky top-0 z-30 h-12 items-center gap-2 border-b bg-card/80 backdrop-blur px-4">
        <button
          onClick={() => setPaletteOpen(true)}
          className="flex flex-1 max-w-md items-center gap-2 rounded-md border bg-background/50 px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent transition-colors"
        >
          <Search className="h-4 w-4" />
          <span>Search anything…</span>
          <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>

        <div className="flex items-center gap-1 ml-auto">
          {perms.canMutate && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" onClick={() => navigate("/sales/new")} className="gap-1">
                    <Receipt className="h-4 w-4" /> <span className="hidden lg:inline">New Sale</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>New Sale</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" onClick={() => navigate("/purchases/new")} className="gap-1">
                    <ShoppingCart className="h-4 w-4" /> <span className="hidden lg:inline">Purchase</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>New Purchase</TooltipContent>
              </Tooltip>
              {perms.canRecordCollections && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" onClick={() => navigate("/collections")} className="gap-1">
                      <Wallet className="h-4 w-4" /> <span className="hidden lg:inline">Payment</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Record Payment</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" onClick={() => navigate("/customers/new")} className="gap-1">
                    <UserPlus className="h-4 w-4" /> <span className="hidden lg:inline">Customer</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>New Customer</TooltipContent>
              </Tooltip>
            </>
          )}
          <NotificationsBell />
        </div>
      </header>

      {/* Mobile floating search button */}
      <div className="md:hidden absolute top-2 right-14 z-40 flex items-center gap-1">
        <Button size="icon" variant="ghost" onClick={() => setPaletteOpen(true)} aria-label="Search">
          <Search className="h-4 w-4" />
        </Button>
        <NotificationsBell />
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  );
}
