import { api } from '@/lib/data/vpsAdapter';

export interface Branch {
  id: string;
  dealer_id: string;
  code: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  manager_name?: string | null;
  is_active: boolean;
  is_default: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notice {
  id: string;
  dealer_id: string;
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
  audience: 'all' | 'admin' | 'manager' | 'accountant' | 'salesman';
  start_date?: string | null;
  end_date?: string | null;
  is_active: boolean;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export const branchService = {
  list: () => api.get<Branch[]>('/api/branches'),
  create: (data: Partial<Branch>) => api.post<Branch>('/api/branches', data),
  update: (id: string, data: Partial<Branch>) => api.put<Branch>(`/api/branches/${id}`, data),
  remove: (id: string) => api.delete(`/api/branches/${id}`),
};

export const noticeService = {
  list: () => api.get<Notice[]>('/api/notices'),
  listActive: () => api.get<Notice[]>('/api/notices/active'),
  create: (data: Partial<Notice>) => api.post<Notice>('/api/notices', data),
  update: (id: string, data: Partial<Notice>) => api.put<Notice>(`/api/notices/${id}`, data),
  remove: (id: string) => api.delete(`/api/notices/${id}`),
};
