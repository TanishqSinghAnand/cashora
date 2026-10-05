export type TransactionType = "CASH_IN" | "CASH_OUT";
export type Permission = "VIEW" | "EDIT";
export type CashbookRole = "OWNER" | "COLLABORATOR";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  photoUrl: string | null;
  role: "USER" | "SUPER_ADMIN";
}

export interface BalanceSummary {
  initialBalanceMinor: number;
  cashInMinor: number;
  cashOutMinor: number;
  currentBalanceMinor: number;
  transactionCount: number;
}

export interface Cashbook {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  ownerId: string;
  currency: string;
  initialBalanceMinor: number;
  createdAt: string;
  updatedAt: string;
}

export interface CashbookWithBalance extends Cashbook {
  role: CashbookRole;
  balance: BalanceSummary;
}

export interface Transaction {
  id: string;
  cashbookId: string;
  type: TransactionType;
  amountMinor: number;
  description: string | null;
  person: string | null;
  category: string | null;
  notes: string | null;
  occurredAt: string;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CollaboratorInfo {
  id: string;
  userId: string;
  name: string;
  photoUrl: string | null;
  permission: Permission;
}

export interface PendingInvitation {
  id: string;
  token: string;
  cashbookName: string;
  inviterName: string;
  permission: Permission;
  createdAt: string;
}
