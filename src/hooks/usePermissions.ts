import { useAuth } from "@/contexts/AuthContext";

export interface Permissions {
  canViewCostPrice: boolean;
  canViewProfit: boolean;
  canViewMargin: boolean;
  canEditPrices: boolean;
  canAdjustStock: boolean;
  canOverrideCredit: boolean;
  canRecordCollections: boolean;
  canDeleteRecords: boolean;
  canExportReports: boolean;
  canManageUsers: boolean;
  canViewSupplierLedger: boolean;
  canViewExpenseLedger: boolean;
  canViewFinancialDashboard: boolean;
  /**
   * Demo accounts can VIEW everything but cannot mutate anything.
   * `canMutate` is the umbrella flag for forms, save buttons, and any
   * action that would create/update/delete data. Use it in addition to
   * any role-based check on UI mutations.
   */
  canMutate: boolean;
  isDealerAdmin: boolean;
  isSalesman: boolean;
  isSuperAdmin: boolean;
  isManager: boolean;
  isAccountant: boolean;
  isDemo: boolean;
}

export function usePermissions(): Permissions {
  const { roles, isSuperAdmin, isDealerAdmin, isDemo } = useAuth();
  const isSalesman = roles.some((r) => r.role === "salesman");
  const isManager = roles.some((r) => r.role === "manager");
  const isAccountant = roles.some((r) => r.role === "accountant");

  // Owner / super admin → full access
  const isPrivileged = isDealerAdmin || isSuperAdmin;

  // Demo blocks all mutations regardless of role
  const canMutate = !isDemo;

  // Manager: full operational write but no team/billing
  // Accountant: read finances, edit collections / expenses; no inventory writes
  const canSeeFinance = isPrivileged || isAccountant || isManager;
  const canOperate = isPrivileged || isManager;

  return {
    canViewCostPrice: canSeeFinance,
    canViewProfit: canSeeFinance,
    canViewMargin: canSeeFinance,
    canEditPrices: canOperate && canMutate,
    canAdjustStock: canOperate && canMutate,
    canOverrideCredit: isPrivileged && canMutate,
    canRecordCollections: (isPrivileged || isAccountant) && canMutate,
    canDeleteRecords: isPrivileged && canMutate,
    canExportReports: canSeeFinance,
    canManageUsers: isPrivileged && canMutate,
    canViewSupplierLedger: canSeeFinance,
    canViewExpenseLedger: canSeeFinance,
    canViewFinancialDashboard: canSeeFinance,
    canMutate,
    isDealerAdmin,
    isSalesman,
    isSuperAdmin,
    isManager,
    isAccountant,
    isDemo,
  };
}
