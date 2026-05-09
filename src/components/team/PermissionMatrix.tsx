import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Minus } from "lucide-react";
import { ROLE_META, type AppRole } from "@/services/teamService";

interface PermissionRow {
  group: string;
  label: string;
  /** roles that have this permission */
  roles: AppRole[];
}

const ROLES: AppRole[] = ["dealer_admin", "manager", "accountant", "salesman"];

// Mirrors usePermissions.ts — keep the two in sync.
const ROWS: PermissionRow[] = [
  { group: "Sales", label: "Create sales / quotations", roles: ["dealer_admin", "manager", "salesman"] },
  { group: "Sales", label: "Edit / cancel sales", roles: ["dealer_admin", "manager"] },
  { group: "Sales", label: "Delete sales", roles: ["dealer_admin"] },
  { group: "Sales", label: "View profit & margin", roles: ["dealer_admin", "manager", "accountant"] },

  { group: "Inventory", label: "View stock & batches", roles: ["dealer_admin", "manager", "accountant", "salesman"] },
  { group: "Inventory", label: "Adjust stock", roles: ["dealer_admin", "manager"] },
  { group: "Inventory", label: "Edit prices / costs", roles: ["dealer_admin", "manager"] },

  { group: "Purchases", label: "Create purchases", roles: ["dealer_admin", "manager"] },
  { group: "Purchases", label: "Manage suppliers", roles: ["dealer_admin", "manager"] },

  { group: "Finance", label: "Customer & supplier ledgers", roles: ["dealer_admin", "manager", "accountant"] },
  { group: "Finance", label: "Record payment collections", roles: ["dealer_admin", "manager", "accountant"] },
  { group: "Finance", label: "Manage expenses", roles: ["dealer_admin", "manager", "accountant"] },
  { group: "Finance", label: "Override credit limits", roles: ["dealer_admin"] },

  { group: "Reports", label: "Operational reports", roles: ["dealer_admin", "manager", "accountant"] },
  { group: "Reports", label: "Financial reports", roles: ["dealer_admin", "accountant"] },
  { group: "Reports", label: "Export data", roles: ["dealer_admin", "manager", "accountant"] },

  { group: "Admin", label: "Manage team & roles", roles: ["dealer_admin"] },
  { group: "Admin", label: "Subscription & billing", roles: ["dealer_admin"] },
  { group: "Admin", label: "Backup & restore", roles: ["dealer_admin"] },
];

const PermissionMatrix = () => {
  const groups = Array.from(new Set(ROWS.map((r) => r.group)));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Permission Matrix</CardTitle>
        <CardDescription>
          What each role can see and do. This matrix is read-only — granular per-permission overrides
          are not supported yet.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-y">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Permission</th>
                {ROLES.map((r) => (
                  <th key={r} className="text-center px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                    {ROLE_META[r].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <>
                  <tr key={`group-${group}`} className="bg-muted/20 border-y">
                    <td colSpan={ROLES.length + 1} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {group}
                    </td>
                  </tr>
                  {ROWS.filter((r) => r.group === group).map((row) => (
                    <tr key={`${row.group}-${row.label}`} className="border-b last:border-0">
                      <td className="px-4 py-2.5">{row.label}</td>
                      {ROLES.map((r) => (
                        <td key={r} className="text-center px-4 py-2.5">
                          {row.roles.includes(r) ? (
                            <Check className="h-4 w-4 inline-block text-emerald-500" />
                          ) : (
                            <Minus className="h-4 w-4 inline-block text-muted-foreground/50" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default PermissionMatrix;
