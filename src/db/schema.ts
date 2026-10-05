import {
  pgTable,
  pgEnum,
  text,
  bigint,
  integer,
  timestamp,
  uuid,
  index,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const transactionTypeEnum = pgEnum("transaction_type", ["CASH_IN", "CASH_OUT"]);
export const collaboratorPermissionEnum = pgEnum("collaborator_permission", ["VIEW", "EDIT"]);
export const invitationStatusEnum = pgEnum("invitation_status", ["PENDING", "ACCEPTED", "DECLINED", "EXPIRED"]);
export const userRoleEnum = pgEnum("user_role", ["USER", "SUPER_ADMIN"]);

// Amounts are stored as bigint minor units (e.g. paise) to avoid floating point errors.

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    // Email is the identity itself — verified via a one-time code sent to
    // it (see server/otp.ts), never nullable.
    email: text("email").notNull(),
    photoUrl: text("photo_url"),
    role: userRoleEnum("role").notNull().default("USER"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_idx").on(table.email)]
);

export const cashbooks = pgTable(
  "cashbooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category"),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    currency: text("currency").notNull().default("INR"),
    initialBalanceMinor: bigint("initial_balance_minor", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("cashbooks_owner_id_idx").on(table.ownerId)]
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cashbookId: uuid("cashbook_id")
      .notNull()
      .references(() => cashbooks.id, { onDelete: "cascade" }),
    type: transactionTypeEnum("type").notNull(),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    description: text("description"),
    person: text("person"),
    category: text("category"),
    notes: text("notes"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientRequestId: text("client_request_id"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("transactions_cashbook_id_idx").on(table.cashbookId),
    index("transactions_created_at_idx").on(table.createdAt),
    uniqueIndex("transactions_dedupe_idx").on(table.cashbookId, table.createdBy, table.clientRequestId),
  ]
);

export const collaborators = pgTable(
  "collaborators",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cashbookId: uuid("cashbook_id")
      .notNull()
      .references(() => cashbooks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    permission: collaboratorPermissionEnum("permission").notNull().default("EDIT"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("collaborators_user_id_idx").on(table.userId),
    index("collaborators_cashbook_id_idx").on(table.cashbookId),
    uniqueIndex("collaborators_unique_idx").on(table.cashbookId, table.userId),
  ]
);

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cashbookId: uuid("cashbook_id")
      .notNull()
      .references(() => cashbooks.id, { onDelete: "cascade" }),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: text("email"),
    permission: collaboratorPermissionEnum("permission").notNull().default("EDIT"),
    status: invitationStatusEnum("status").notNull().default("PENDING"),
    token: text("token").notNull(),
    invitedUserId: uuid("invited_user_id").references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (table) => [
    index("invitations_email_idx").on(table.email),
    uniqueIndex("invitations_token_idx").on(table.token),
    index("invitations_invited_user_id_idx").on(table.invitedUserId),
  ]
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    description: text("description"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("audit_logs_entity_idx").on(table.entity, table.entityId)]
);

export const authSessions = pgTable(
  "authentication_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("auth_sessions_token_hash_idx").on(table.tokenHash),
    index("auth_sessions_user_id_idx").on(table.userId),
  ]
);

export const authRateLimits = pgTable(
  "auth_rate_limits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("auth_rate_limits_key_idx").on(table.key, table.createdAt)]
);

export const emailOtpCodes = pgTable(
  "email_otp_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("email_otp_codes_email_idx").on(table.email, table.createdAt)]
);

export const usersRelations = relations(users, ({ many }) => ({
  cashbooks: many(cashbooks),
  collaborations: many(collaborators),
}));

export const cashbooksRelations = relations(cashbooks, ({ one, many }) => ({
  owner: one(users, { fields: [cashbooks.ownerId], references: [users.id] }),
  transactions: many(transactions),
  collaborators: many(collaborators),
  invitations: many(invitations),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  cashbook: one(cashbooks, { fields: [transactions.cashbookId], references: [cashbooks.id] }),
  creator: one(users, { fields: [transactions.createdBy], references: [users.id] }),
}));

export const collaboratorsRelations = relations(collaborators, ({ one }) => ({
  cashbook: one(cashbooks, { fields: [collaborators.cashbookId], references: [cashbooks.id] }),
  user: one(users, { fields: [collaborators.userId], references: [users.id] }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  cashbook: one(cashbooks, { fields: [invitations.cashbookId], references: [cashbooks.id] }),
  inviter: one(users, { fields: [invitations.invitedBy], references: [users.id] }),
  invitedUser: one(users, { fields: [invitations.invitedUserId], references: [users.id] }),
}));
