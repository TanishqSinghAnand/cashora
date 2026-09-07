import { ArrowDownLeft, ArrowUpRight, Sheet as SheetIcon, ShieldCheck, Users } from "lucide-react";

export function TrackCashVisual() {
  return (
    <div className="glass rounded-3xl p-6">
      <p className="text-xs text-muted mb-1">Today</p>
      <div className="flex flex-col divide-y divide-border">
        {[
          { icon: ArrowDownLeft, label: "Customer Payment", amount: "+₹5,000", color: "text-cash-in" },
          { icon: ArrowUpRight, label: "Stock Purchase", amount: "-₹2,500", color: "text-cash-out" },
          { icon: ArrowDownLeft, label: "Invoice Payment", amount: "+₹8,000", color: "text-cash-in" },
        ].map((row, i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <div className={`h-9 w-9 rounded-full bg-surface-2 flex items-center justify-center ${row.color}`}>
              <row.icon size={16} />
            </div>
            <p className="text-sm flex-1">{row.label}</p>
            <p className={`text-sm font-semibold ${row.color}`}>{row.amount}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CollaborateVisual() {
  return (
    <div className="glass rounded-3xl p-6 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Users size={16} className="text-primary" />
        <p className="text-sm font-medium">Sharma General Store</p>
      </div>
      {[
        { name: "Tanishq", role: "Owner" },
        { name: "Rahul", role: "Can edit" },
      ].map((p) => (
        <div key={p.name} className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center text-sm font-semibold text-primary">
            {p.name[0]}
          </div>
          <p className="text-sm flex-1">{p.name}</p>
          <span className="text-xs text-muted">{p.role}</span>
        </div>
      ))}
    </div>
  );
}

export function SheetsVisual() {
  return (
    <div className="glass rounded-3xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <SheetIcon size={16} className="text-primary" />
        <p className="text-sm font-medium">Transactions</p>
      </div>
      <div className="grid grid-cols-4 gap-px bg-border rounded-lg overflow-hidden text-[11px]">
        {["ID", "Type", "Amount", "Person"].map((h) => (
          <div key={h} className="bg-surface-2 p-2 font-medium">
            {h}
          </div>
        ))}
        {["TXN-041", "CASH_IN", "₹5,000", "Rahul"].map((v) => (
          <div key={v} className="bg-surface p-2 text-muted">
            {v}
          </div>
        ))}
        {["TXN-042", "CASH_OUT", "₹2,500", "Supplier"].map((v) => (
          <div key={v} className="bg-surface p-2 text-muted">
            {v}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SecurityVisual() {
  return (
    <div className="glass rounded-3xl p-8 flex flex-col items-center text-center gap-3">
      <div className="h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center text-primary">
        <ShieldCheck size={26} />
      </div>
      <p className="font-semibold">Every cashbook is isolated</p>
      <p className="text-sm text-muted">Server-side checks on every request — no one sees data they don&apos;t own.</p>
    </div>
  );
}
