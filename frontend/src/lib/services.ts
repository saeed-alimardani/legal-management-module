import { apiRequest, buildQuery, downloadFile } from './api';
import type {
  ActivityLog,
  CaseParty,
  Contract,
  DashboardSummary,
  Deadline,
  Discussion,
  Document,
  FinancialRecord,
  LegalCase,
  LegalNotice,
  PaginatedResponse,
  Reminder,
  SingleResponse,
  Task,
  TimelineEntry,
  User,
  UserDirectoryEntry,
} from './types';

export const authApi = {
  me: () => apiRequest<SingleResponse<User>>('/auth/me'),
};

export const dashboardApi = {
  summary: () =>
    apiRequest<SingleResponse<DashboardSummary>>('/dashboard/summary'),
};

export const usersApi = {
  directory: () =>
    apiRequest<SingleResponse<UserDirectoryEntry[]>>('/users/directory'),
  list: (params: Record<string, string | number | undefined> = {}) =>
    apiRequest<PaginatedResponse<User>>(`/users${buildQuery(params)}`),
  get: (id: string) => apiRequest<SingleResponse<User>>(`/users/${id}`),
  create: (body: Record<string, unknown>) =>
    apiRequest<SingleResponse<User>>('/users', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  update: (id: string, body: Record<string, unknown>) =>
    apiRequest<SingleResponse<User>>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};

export const casesApi = {
  list: (params: Record<string, string | number | undefined> = {}) =>
    apiRequest<PaginatedResponse<LegalCase>>(`/cases${buildQuery(params)}`),
  get: (id: string) => apiRequest<SingleResponse<LegalCase>>(`/cases/${id}`),
  create: (body: Record<string, unknown>) =>
    apiRequest<SingleResponse<LegalCase>>('/cases', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  update: (id: string, body: Record<string, unknown>) =>
    apiRequest<SingleResponse<LegalCase>>(`/cases/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  delete: (id: string) =>
    apiRequest<SingleResponse<LegalCase>>(`/cases/${id}`, { method: 'DELETE' }),
  reassign: (id: string, ownerId: string) =>
    apiRequest<SingleResponse<LegalCase>>(`/cases/${id}/reassign`, {
      method: 'POST',
      body: JSON.stringify({ ownerId }),
    }),
  listParties: (id: string) =>
    apiRequest<SingleResponse<CaseParty[]>>(
      `/cases/${id}/parties`,
    ),
  addParty: (id: string, body: Record<string, unknown>) =>
    apiRequest<SingleResponse<CaseParty>>(`/cases/${id}/parties`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateParty: (id: string, partyId: string, body: Record<string, unknown>) =>
    apiRequest<SingleResponse<unknown>>(`/cases/${id}/parties/${partyId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteParty: (id: string, partyId: string) =>
    apiRequest<SingleResponse<unknown>>(`/cases/${id}/parties/${partyId}`, {
      method: 'DELETE',
    }),
  timeline: (id: string, page = 1, limit = 20) =>
    apiRequest<PaginatedResponse<TimelineEntry>>(
      `/cases/${id}/timeline${buildQuery({ page, limit })}`,
    ),
};

export const contractsApi = {
  list: (params: Record<string, string | number | undefined> = {}) =>
    apiRequest<PaginatedResponse<Contract>>(`/contracts${buildQuery(params)}`),
  get: (id: string) => apiRequest<SingleResponse<Contract>>(`/contracts/${id}`),
  create: (body: Record<string, unknown>) =>
    apiRequest<SingleResponse<Contract>>('/contracts', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  update: (id: string, body: Record<string, unknown>) =>
    apiRequest<SingleResponse<Contract>>(`/contracts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  delete: (id: string) =>
    apiRequest<SingleResponse<Contract>>(`/contracts/${id}`, {
      method: 'DELETE',
    }),
  reassign: (id: string, ownerId: string) =>
    apiRequest<SingleResponse<Contract>>(`/contracts/${id}/reassign`, {
      method: 'POST',
      body: JSON.stringify({ ownerId }),
    }),
};

export const noticesApi = {
  list: (params: Record<string, string | number | undefined> = {}) =>
    apiRequest<PaginatedResponse<LegalNotice>>(`/notices${buildQuery(params)}`),
  get: (id: string) =>
    apiRequest<SingleResponse<LegalNotice>>(`/notices/${id}`),
  create: (body: Record<string, unknown>) =>
    apiRequest<SingleResponse<LegalNotice>>('/notices', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  update: (id: string, body: Record<string, unknown>) =>
    apiRequest<SingleResponse<LegalNotice>>(`/notices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  delete: (id: string) =>
    apiRequest<SingleResponse<LegalNotice>>(`/notices/${id}`, {
      method: 'DELETE',
    }),
  reassign: (id: string, ownerId: string) =>
    apiRequest<SingleResponse<LegalNotice>>(`/notices/${id}/reassign`, {
      method: 'POST',
      body: JSON.stringify({ ownerId }),
    }),
};

export const deadlinesApi = {
  list: (params: Record<string, string | number | undefined> = {}) =>
    apiRequest<PaginatedResponse<Deadline>>(`/deadlines${buildQuery(params)}`),
  get: (id: string) =>
    apiRequest<SingleResponse<Deadline>>(`/deadlines/${id}`),
  create: (body: Record<string, unknown>) =>
    apiRequest<SingleResponse<Deadline>>('/deadlines', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  update: (id: string, body: Record<string, unknown>) =>
    apiRequest<SingleResponse<Deadline>>(`/deadlines/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  delete: (id: string) =>
    apiRequest<SingleResponse<Deadline>>(`/deadlines/${id}`, {
      method: 'DELETE',
    }),
};

export const remindersApi = {
  list: (params: Record<string, string | number | undefined> = {}) =>
    apiRequest<PaginatedResponse<Reminder>>(`/reminders${buildQuery(params)}`),
  get: (id: string) =>
    apiRequest<SingleResponse<Reminder>>(`/reminders/${id}`),
  create: (body: Record<string, unknown>) =>
    apiRequest<SingleResponse<Reminder>>('/reminders', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  update: (id: string, body: Record<string, unknown>) =>
    apiRequest<SingleResponse<Reminder>>(`/reminders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  processDue: () =>
    apiRequest<SingleResponse<{ processedCount: number; reminders: Reminder[] }>>(
      '/reminders/process-due',
      { method: 'POST' },
    ),
};

export const tasksApi = {
  list: (params: Record<string, string | number | undefined> = {}) =>
    apiRequest<PaginatedResponse<Task>>(`/tasks${buildQuery(params)}`),
  get: (id: string) => apiRequest<SingleResponse<Task>>(`/tasks/${id}`),
  create: (body: Record<string, unknown>) =>
    apiRequest<SingleResponse<Task>>('/tasks', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  update: (id: string, body: Record<string, unknown>) =>
    apiRequest<SingleResponse<Task>>(`/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  delete: (id: string) =>
    apiRequest<SingleResponse<Task>>(`/tasks/${id}`, { method: 'DELETE' }),
};

export const documentsApi = {
  list: (params: Record<string, string | undefined>) =>
    apiRequest<SingleResponse<Document[]>>(
      `/documents${buildQuery(params)}`,
    ),
  get: (id: string) =>
    apiRequest<SingleResponse<Document>>(`/documents/${id}`),
  upload: (formData: FormData) =>
    apiRequest<SingleResponse<Document>>('/documents', {
      method: 'POST',
      body: formData,
    }),
  delete: (id: string) =>
    apiRequest<SingleResponse<Document>>(`/documents/${id}`, {
      method: 'DELETE',
    }),
  download: (id: string, fileName: string) =>
    downloadFile(`/documents/${id}/download`, fileName),
};

export const discussionsApi = {
  list: (params: Record<string, string | number | undefined> = {}) =>
    apiRequest<PaginatedResponse<Discussion>>(
      `/discussions${buildQuery(params)}`,
    ),
  get: (id: string) =>
    apiRequest<SingleResponse<Discussion>>(`/discussions/${id}`),
  create: (body: Record<string, unknown>) =>
    apiRequest<SingleResponse<Discussion>>('/discussions', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  update: (id: string, body: Record<string, unknown>) =>
    apiRequest<SingleResponse<Discussion>>(`/discussions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  delete: (id: string) =>
    apiRequest<SingleResponse<Discussion>>(`/discussions/${id}`, {
      method: 'DELETE',
    }),
};

export const financialRecordsApi = {
  list: (params: Record<string, string | number | undefined> = {}) =>
    apiRequest<PaginatedResponse<FinancialRecord>>(
      `/financial-records${buildQuery(params)}`,
    ),
  get: (id: string) =>
    apiRequest<SingleResponse<FinancialRecord>>(`/financial-records/${id}`),
  create: (body: Record<string, unknown>) =>
    apiRequest<SingleResponse<FinancialRecord>>('/financial-records', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  update: (id: string, body: Record<string, unknown>) =>
    apiRequest<SingleResponse<FinancialRecord>>(`/financial-records/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  delete: (id: string) =>
    apiRequest<SingleResponse<FinancialRecord>>(`/financial-records/${id}`, {
      method: 'DELETE',
    }),
};

export const activityLogsApi = {
  list: (params: Record<string, string | number | undefined> = {}) =>
    apiRequest<PaginatedResponse<ActivityLog>>(
      `/activity-logs${buildQuery(params)}`,
    ),
};

export const offboardingApi = {
  transfer: (body: Record<string, unknown>) =>
    apiRequest<
      SingleResponse<{
        cases: number;
        contracts: number;
        notices: number;
        tasks: number;
        deadlines: number;
      }>
    >('/offboarding/transfer', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
