import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Receipt, ShoppingCart, Wallet, Users, Package, BarChart3, ShieldCheck,
  Truck, FileText, Search, Plus, LayoutDashboard, Settings,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { customerService } from "@/services/customerService";
import { productService } from "@/services/productService";
import { supplierService } from "@/services/supplierService";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const perms = usePermissions();
  const dealerId = profile?.dealer_id ?? "";
  const [query, setQuery] = useState("");

  // Debounce
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  const enabled = open && !!dealerId && debounced.length >= 2;

  const customersQ = useQuery({
    queryKey: ["cmdk-customers", dealerId, debounced],
    queryFn: () => customerService.list(dealerId, debounced, "", 1),
    enabled,
    staleTime: 30_000,
  });
  const productsQ = useQuery({
    queryKey: ["cmdk-products", dealerId, debounced],
    queryFn: () => productService.list(dealerId, debounced, 1),
    enabled,
    staleTime: 30_000,
  });
  const suppliersQ = useQuery({
    queryKey: ["cmdk-suppliers", dealerId, debounced],
    queryFn: () => supplierService.list(dealerId, debounced, 1),
    enabled,
    staleTime: 30_000,
  });

  const go = (path: string) => {
    onOpenChange(false);
    setQuery("");
    navigate(path);
  };

  const customers = (customersQ.data as any)?.data ?? (customersQ.data as any)?.items ?? [];
  const products = (productsQ.data as any)?.data ?? (productsQ.data as any)?.items ?? [];
  const suppliers = (suppliersQ.data as any)?.data ?? (suppliersQ.data as any)?.items ?? [];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search customers, products, suppliers… or type a command"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {debounced.length < 2 ? "Type at least 2 characters to search" : "No results found"}
        </CommandEmpty>

        <CommandGroup heading="Quick Actions">
          {perms.canMutate && (
            <>
              <CommandItem onSelect={() => go("/sales/new")}>
                <Plus className="mr-2 h-4 w-4 text-primary" /> New Sale
                <span className="ml-auto text-xs text-muted-foreground">F2</span>
              </CommandItem>
              <CommandItem onSelect={() => go("/purchases/new")}>
                <Plus className="mr-2 h-4 w-4 text-primary" /> New Purchase
              </CommandItem>
              {perms.canRecordCollections && (
                <CommandItem onSelect={() => go("/collections")}>
                  <Wallet className="mr-2 h-4 w-4 text-primary" /> Record Payment
                </CommandItem>
              )}
              <CommandItem onSelect={() => go("/customers/new")}>
                <Plus className="mr-2 h-4 w-4 text-primary" /> New Customer
              </CommandItem>
              <CommandItem onSelect={() => go("/products/new")}>
                <Plus className="mr-2 h-4 w-4 text-primary" /> New Product
              </CommandItem>
            </>
          )}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => go("/dashboard")}>
            <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
          </CommandItem>
          <CommandItem onSelect={() => go("/sales")}>
            <Receipt className="mr-2 h-4 w-4" /> Sales
          </CommandItem>
          <CommandItem onSelect={() => go("/purchases")}>
            <ShoppingCart className="mr-2 h-4 w-4" /> Purchases
          </CommandItem>
          <CommandItem onSelect={() => go("/customers")}>
            <Users className="mr-2 h-4 w-4" /> Customers
          </CommandItem>
          <CommandItem onSelect={() => go("/products")}>
            <Package className="mr-2 h-4 w-4" /> Products
          </CommandItem>
          <CommandItem onSelect={() => go("/suppliers")}>
            <Truck className="mr-2 h-4 w-4" /> Suppliers
          </CommandItem>
          <CommandItem onSelect={() => go("/ledger")}>
            <FileText className="mr-2 h-4 w-4" /> Ledger
          </CommandItem>
          <CommandItem onSelect={() => go("/reports")}>
            <BarChart3 className="mr-2 h-4 w-4" /> Reports
          </CommandItem>
          {perms.isDealerAdmin && (
            <>
              <CommandItem onSelect={() => go("/approvals")}>
                <ShieldCheck className="mr-2 h-4 w-4" /> Approvals
              </CommandItem>
              <CommandItem onSelect={() => go("/settings")}>
                <Settings className="mr-2 h-4 w-4" /> Settings
              </CommandItem>
            </>
          )}
        </CommandGroup>

        {customers.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Customers">
              {customers.slice(0, 6).map((c: any) => (
                <CommandItem key={c.id} onSelect={() => go(`/customers/${c.id}/edit`)}>
                  <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{c.name}</span>
                  {c.phone && <span className="ml-auto text-xs text-muted-foreground">{c.phone}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {products.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Products">
              {products.slice(0, 6).map((p: any) => (
                <CommandItem key={p.id} onSelect={() => go(`/products/${p.id}/edit`)}>
                  <Package className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{p.name}</span>
                  {p.sku && <span className="ml-auto text-xs text-muted-foreground">{p.sku}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {suppliers.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Suppliers">
              {suppliers.slice(0, 6).map((s: any) => (
                <CommandItem key={s.id} onSelect={() => go(`/suppliers/${s.id}/edit`)}>
                  <Truck className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{s.name}</span>
                  {s.phone && <span className="ml-auto text-xs text-muted-foreground">{s.phone}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
