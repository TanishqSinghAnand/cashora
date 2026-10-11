import "server-only";
import { and, eq, isNull, desc } from "drizzle-orm";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import ExcelJS from "exceljs";
import { db } from "@/db";
import { cashbooks, collaborators, transactions, users } from "@/db/schema";
import { computeBalance, type BalanceSummary } from "@/server/balance";
import { formatMoney, fromMinorUnits } from "@/lib/money";
import { NotFoundError } from "@/server/permissions";
import { sendCashbookUpdateEmail } from "@/server/mailer";
import { isSmtpConfigured } from "@/lib/env";

export interface CashbookExportData {
  cashbook: { id: string; name: string; description: string | null; currency: string };
  owner: { name: string; email: string | null };
  collaborators: { name: string; email: string | null; permission: string }[];
  balance: BalanceSummary;
  transactions: Array<{
    id: string;
    type: "CASH_IN" | "CASH_OUT";
    amountMinor: number;
    person: string | null;
    description: string | null;
    category: string | null;
    notes: string | null;
    occurredAt: Date;
    createdByName: string;
  }>;
  generatedAt: Date;
}

/**
 * Everyone with a stake in a cashbook — used both for export file recipients
 * and the "notify everyone" list on transaction updates. Owner first.
 */
export async function getCashbookExportData(cashbookId: string): Promise<CashbookExportData> {
  const [cashbook] = await db.select().from(cashbooks).where(eq(cashbooks.id, cashbookId)).limit(1);
  if (!cashbook) throw new NotFoundError("Cashbook not found");

  const [owner] = await db.select().from(users).where(eq(users.id, cashbook.ownerId)).limit(1);

  const collabRows = await db
    .select({ collaborator: collaborators, user: users })
    .from(collaborators)
    .innerJoin(users, eq(collaborators.userId, users.id))
    .where(eq(collaborators.cashbookId, cashbookId));

  const txRows = await db
    .select({ transaction: transactions, creator: users })
    .from(transactions)
    .innerJoin(users, eq(transactions.createdBy, users.id))
    .where(and(eq(transactions.cashbookId, cashbookId), isNull(transactions.deletedAt)))
    .orderBy(desc(transactions.occurredAt));

  const balance = await computeBalance(cashbookId, cashbook.initialBalanceMinor);

  return {
    cashbook: {
      id: cashbook.id,
      name: cashbook.name,
      description: cashbook.description,
      currency: cashbook.currency,
    },
    owner: { name: owner?.name ?? "Unknown", email: owner?.email ?? null },
    collaborators: collabRows.map((row) => ({
      name: row.user.name,
      email: row.user.email,
      permission: row.collaborator.permission,
    })),
    balance,
    transactions: txRows.map((row) => ({
      id: row.transaction.id,
      type: row.transaction.type,
      amountMinor: row.transaction.amountMinor,
      person: row.transaction.person,
      description: row.transaction.description,
      category: row.transaction.category,
      notes: row.transaction.notes,
      occurredAt: row.transaction.occurredAt,
      createdByName: row.creator.name,
    })),
    generatedAt: new Date(),
  };
}

/** Owner + every collaborator's email, deduped — the "share with everyone" list. */
export function getCashbookRecipientEmails(data: CashbookExportData): string[] {
  const emails = new Set<string>();
  if (data.owner.email) emails.add(data.owner.email);
  for (const c of data.collaborators) {
    if (c.email) emails.add(c.email);
  }
  return Array.from(emails);
}

const pdfStyles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#10120f" },
  eyebrow: { fontSize: 8, color: "#6b7169", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 9, color: "#6b7169", marginBottom: 16 },
  partiesRow: { fontSize: 8, color: "#6b7169", marginBottom: 16 },
  statsRow: { flexDirection: "row", marginBottom: 20 },
  statBox: { flex: 1, padding: 10, marginRight: 8, border: "1px solid #ddd", borderRadius: 4 },
  statLabel: { fontSize: 7, color: "#6b7169", marginBottom: 3, textTransform: "uppercase" },
  statValue: { fontSize: 13, fontWeight: 700 },
  tableHeader: { flexDirection: "row", borderBottom: "1px solid #10120f", paddingBottom: 5, marginBottom: 4 },
  tableRow: { flexDirection: "row", borderBottom: "1px solid #eee", paddingVertical: 4 },
  headerCell: { fontSize: 7, fontWeight: 700, textTransform: "uppercase", color: "#6b7169" },
  cell: { fontSize: 8 },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 7, color: "#9aa0a6", textAlign: "center" },
});

const COLS = [
  { key: "date", width: "13%" },
  { key: "type", width: "9%" },
  { key: "amount", width: "14%" },
  { key: "person", width: "16%" },
  { key: "description", width: "27%" },
  { key: "createdBy", width: "21%" },
] as const;

function CashbookStatementDocument({ data }: { data: CashbookExportData }) {
  const collaboratorNames = data.collaborators.map((c) => c.name).join(", ") || "None";

  return (
    <Document title={`${data.cashbook.name} — Cashbook Statement`}>
      <Page size="A4" style={pdfStyles.page}>
        <Text style={pdfStyles.eyebrow}>My Cashbook</Text>
        <Text style={pdfStyles.title}>{data.cashbook.name}</Text>
        <Text style={pdfStyles.subtitle}>
          Statement generated {data.generatedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
        </Text>
        <Text style={pdfStyles.partiesRow}>
          Owner: {data.owner.name} ({data.owner.email ?? "no email"})  ·  Collaborators: {collaboratorNames}
        </Text>

        <View style={pdfStyles.statsRow}>
          <View style={pdfStyles.statBox}>
            <Text style={pdfStyles.statLabel}>Balance</Text>
            <Text style={pdfStyles.statValue}>{formatMoney(data.balance.currentBalanceMinor, data.cashbook.currency)}</Text>
          </View>
          <View style={pdfStyles.statBox}>
            <Text style={pdfStyles.statLabel}>Cash In</Text>
            <Text style={pdfStyles.statValue}>{formatMoney(data.balance.cashInMinor, data.cashbook.currency)}</Text>
          </View>
          <View style={[pdfStyles.statBox, { marginRight: 0 }]}>
            <Text style={pdfStyles.statLabel}>Cash Out</Text>
            <Text style={pdfStyles.statValue}>{formatMoney(data.balance.cashOutMinor, data.cashbook.currency)}</Text>
          </View>
        </View>

        <Text style={[pdfStyles.subtitle, { marginBottom: 6 }]}>Transactions ({data.transactions.length})</Text>
        <View style={pdfStyles.tableHeader}>
          <Text style={[pdfStyles.headerCell, { width: COLS[0].width }]}>Date</Text>
          <Text style={[pdfStyles.headerCell, { width: COLS[1].width }]}>Type</Text>
          <Text style={[pdfStyles.headerCell, { width: COLS[2].width }]}>Amount</Text>
          <Text style={[pdfStyles.headerCell, { width: COLS[3].width }]}>Person</Text>
          <Text style={[pdfStyles.headerCell, { width: COLS[4].width }]}>Description</Text>
          <Text style={[pdfStyles.headerCell, { width: COLS[5].width }]}>Recorded by</Text>
        </View>
        {data.transactions.map((tx) => (
          <View style={pdfStyles.tableRow} key={tx.id} wrap={false}>
            <Text style={[pdfStyles.cell, { width: COLS[0].width }]}>
              {tx.occurredAt.toLocaleDateString("en-IN")}
            </Text>
            <Text style={[pdfStyles.cell, { width: COLS[1].width }]}>{tx.type === "CASH_IN" ? "In" : "Out"}</Text>
            <Text style={[pdfStyles.cell, { width: COLS[2].width }]}>
              {formatMoney(tx.amountMinor, data.cashbook.currency)}
            </Text>
            <Text style={[pdfStyles.cell, { width: COLS[3].width }]}>{tx.person || "—"}</Text>
            <Text style={[pdfStyles.cell, { width: COLS[4].width }]}>{tx.description || "—"}</Text>
            <Text style={[pdfStyles.cell, { width: COLS[5].width }]}>{tx.createdByName}</Text>
          </View>
        ))}

        <Text style={pdfStyles.footer} fixed>
          Generated by Cashora — cashora-sandy.vercel.app
        </Text>
      </Page>
    </Document>
  );
}

export async function generateCashbookPdfBuffer(data: CashbookExportData): Promise<Buffer> {
  return renderToBuffer(<CashbookStatementDocument data={data} />);
}

export async function generateCashbookExcelBuffer(data: CashbookExportData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Cashora";
  wb.created = data.generatedAt;

  const summary = wb.addWorksheet("Summary");
  summary.columns = [
    { header: "Field", key: "field", width: 24 },
    { header: "Value", key: "value", width: 36 },
  ];
  summary.getRow(1).font = { bold: true };
  summary.addRows([
    { field: "Cashbook", value: data.cashbook.name },
    { field: "Owner", value: `${data.owner.name} (${data.owner.email ?? "no email"})` },
    { field: "Collaborators", value: data.collaborators.map((c) => `${c.name} (${c.permission})`).join(", ") || "None" },
    { field: "Currency", value: data.cashbook.currency },
    { field: "Balance", value: fromMinorUnits(data.balance.currentBalanceMinor) },
    { field: "Cash In", value: fromMinorUnits(data.balance.cashInMinor) },
    { field: "Cash Out", value: fromMinorUnits(data.balance.cashOutMinor) },
    { field: "Transaction Count", value: data.balance.transactionCount },
    { field: "Generated At", value: data.generatedAt.toISOString() },
  ]);

  const sheet = wb.addWorksheet("Transactions");
  sheet.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Type", key: "type", width: 10 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Person", key: "person", width: 20 },
    { header: "Description", key: "description", width: 30 },
    { header: "Category", key: "category", width: 18 },
    { header: "Notes", key: "notes", width: 28 },
    { header: "Recorded By", key: "createdBy", width: 20 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const tx of data.transactions) {
    sheet.addRow({
      date: tx.occurredAt.toISOString().slice(0, 10),
      type: tx.type,
      amount: fromMinorUnits(tx.amountMinor),
      person: tx.person ?? "",
      description: tx.description ?? "",
      category: tx.category ?? "",
      notes: tx.notes ?? "",
      createdBy: tx.createdByName,
    });
  }
  sheet.getColumn("amount").numFmt = "#,##0.00";

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "cashbook";
}

/**
 * Emails the owner + every collaborator a full PDF + Excel statement after a
 * transaction change — "share all updates with everyone on the cashbook".
 * No-op if SMTP isn't configured, same as the rest of the mailer.
 */
export async function notifyCashbookUpdate(cashbookId: string, actorName: string, changeSummary: string): Promise<void> {
  if (!isSmtpConfigured) return;

  const data = await getCashbookExportData(cashbookId);
  const recipients = getCashbookRecipientEmails(data);
  if (recipients.length === 0) return;

  const [pdfBuffer, excelBuffer] = await Promise.all([generateCashbookPdfBuffer(data), generateCashbookExcelBuffer(data)]);

  await sendCashbookUpdateEmail(recipients, {
    actorName,
    cashbookName: data.cashbook.name,
    changeSummary,
    balanceText: formatMoney(data.balance.currentBalanceMinor, data.cashbook.currency),
    cashInText: formatMoney(data.balance.cashInMinor, data.cashbook.currency),
    cashOutText: formatMoney(data.balance.cashOutMinor, data.cashbook.currency),
    pdfBuffer,
    excelBuffer,
    fileSlug: slugify(data.cashbook.name),
  });
}
