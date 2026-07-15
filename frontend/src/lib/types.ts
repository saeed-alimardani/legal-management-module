export type UserRole =
  | 'LEGAL_ADMIN'
  | 'LEGAL_MANAGER'
  | 'LEGAL_COUNSEL'
  | 'VIEWER';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

export interface LoginResult {
  accessToken: string;
  user: AuthUser;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface SingleResponse<T> {
  data: T;
}

export interface DashboardMetrics {
  openCases: number;
  activeContracts: number;
  pendingNotices: number;
  overdueDeadlines: number;
  todayDeadlines: number;
  myOpenTasks: number;
}

export interface DashboardSummary {
  canViewAll: boolean;
  all: DashboardMetrics;
  my: DashboardMetrics;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserDirectoryEntry {
  id: string;
  fullName: string;
}

export interface LegalCase {
  id: string;
  referenceCode: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  ownerId: string;
  owner?: { id: string; fullName: string; email: string };
  description?: string | null;
  openedDate?: string | null;
  closedDate?: string | null;
  openedDatePersian?: string | null;
  closedDatePersian?: string | null;
  parties?: CaseParty[];
  createdAt: string;
  updatedAt: string;
}

export interface CaseParty {
  id: string;
  caseId: string;
  name: string;
  partyType: string;
  contactInfo?: string | null;
  notes?: string | null;
}

export interface Contract {
  id: string;
  referenceCode: string;
  title: string;
  type: string;
  status: string;
  ownerId: string;
  owner?: { id: string; fullName: string; email: string };
  counterpartyName: string;
  effectiveDate?: string | null;
  expirationDate?: string | null;
  renewalDate?: string | null;
  effectiveDatePersian?: string | null;
  expirationDatePersian?: string | null;
  renewalDatePersian?: string | null;
  keyTerms?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LegalNotice {
  id: string;
  referenceCode: string;
  title: string;
  sender: string;
  receivedDate: string;
  responseDeadline: string;
  receivedDatePersian?: string;
  responseDeadlinePersian?: string;
  status: string;
  ownerId: string;
  owner?: { id: string; fullName: string; email: string };
  description?: string | null;
  relatedCaseId?: string | null;
  relatedContractId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Deadline {
  id: string;
  title: string;
  dueDate: string;
  dueDatePersian?: string;
  status: string;
  assigneeId?: string | null;
  assignee?: { id: string; fullName: string } | null;
  caseId?: string | null;
  contractId?: string | null;
  noticeId?: string | null;
  createdById?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Reminder {
  id: string;
  message?: string | null;
  title?: string;
  remindAt: string;
  remindAtPersian?: string;
  status: string;
  deadlineId: string;
  createdById?: string;
  deadline?: { id: string; title: string; dueDate: string };
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  assigneeId: string;
  assignee?: { id: string; fullName: string };
  dueDate?: string | null;
  dueDatePersian?: string | null;
  caseId?: string | null;
  contractId?: string | null;
  noticeId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  id: string;
  fileName: string;
  documentType: string;
  mimeType: string;
  fileSize: number;
  description?: string | null;
  caseId?: string | null;
  contractId?: string | null;
  noticeId?: string | null;
  uploadedById?: string;
  uploadedAt: string;
  uploadedAtPersian?: string;
}

export interface Discussion {
  id: string;
  content: string;
  authorId?: string;
  caseId?: string | null;
  contractId?: string | null;
  noticeId?: string | null;
  author?: { id: string; fullName: string };
  createdAt: string;
  updatedAt: string;
  createdAtPersian?: string;
  updatedAtPersian?: string;
}

export interface FinancialRecord {
  id: string;
  title: string;
  type: string;
  amount: number | string;
  currency: string;
  recordDate: string;
  recordDatePersian?: string;
  description?: string | null;
  caseId?: string | null;
  contractId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string;
  actor?: { id: string; fullName: string };
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface TimelineEntry {
  id: string;
  action: string;
  actor?: { id: string; fullName: string };
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface ApiError {
  message: string | string[];
  statusCode: number;
}
