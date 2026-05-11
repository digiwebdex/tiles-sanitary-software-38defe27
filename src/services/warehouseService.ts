import { vpsAuthedFetch } from "@/lib/vpsAuthClient";

export interface Warehouse {
  id: string;
  dealer_id: string;
  name: string;
  code: string | null;
  address: string | null;
  manager_name: string | null;
  manager_phone: string | null;
  is_default: boolean;
  is_active: boolean;
  notes: string | null;
}

export interface WarehouseTransfer {
  id: string;
  transfer_no: string | null;
  from_warehouse_id: string | null;
  to_warehouse_id: string | null;
  from_warehouse_name?: string | null;
  to_warehouse_name?: string | null;
  product_id: string | null;
  product_name_snapshot: string | null;
  quantity: number;
  unit: string;
  transport_cost: number;
  payment_method: "cash" | "bank";
  bank_account_id: string | null;
  transfer_date: string;
  notes: string | null;
}

const j = async (r: Response) => {
  if (!r.ok) {
    let msg = "Request failed";
    try { const e = await r.json(); msg = typeof e.error === "string" ? e.error : msg; } catch {}
    throw new Error(msg);
  }
  return r.json();
};

export const warehouseService = {
  list: (dealerId: string) =>
    vpsAuthedFetch(`/api/warehouses?dealerId=${dealerId}`).then(j) as Promise<Warehouse[]>,
  create: (dealerId: string, data: Partial<Warehouse>) =>
    vpsAuthedFetch(`/api/warehouses?dealerId=${dealerId}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }).then(j),
  update: (id: string, dealerId: string, data: Partial<Warehouse>) =>
    vpsAuthedFetch(`/api/warehouses/${id}?dealerId=${dealerId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }).then(j),
  remove: (id: string, dealerId: string) =>
    vpsAuthedFetch(`/api/warehouses/${id}?dealerId=${dealerId}`, { method: "DELETE" }),
  transfers: (dealerId: string, params: { from?: string; to?: string; warehouseId?: string } = {}) => {
    const qs = new URLSearchParams({ dealerId });
    Object.entries(params).forEach(([k, v]) => v && qs.set(k, v));
    return vpsAuthedFetch(`/api/warehouses/transfers?${qs}`).then(j) as Promise<WarehouseTransfer[]>;
  },
  createTransfer: (dealerId: string, data: Partial<WarehouseTransfer>) =>
    vpsAuthedFetch(`/api/warehouses/transfers?dealerId=${dealerId}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }).then(j),
};
