"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label, FieldError } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/tabs";
import { createTransactionSchema, type CreateTransactionFormInput } from "@/validations/transaction";
import { apiFetch } from "@/lib/api-client";

const CATEGORIES_IN = ["Sales", "Loan Received", "Investment", "Refund", "Other"];
const CATEGORIES_OUT = ["Inventory", "Utilities", "Payroll", "Rent", "Supplies", "Other"];

export function AddCashDrawer({
  cashbookId,
  open,
  onClose,
  onSuccess,
  disabled,
}: {
  cashbookId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  disabled?: boolean;
}) {
  const [type, setType] = useState<"CASH_IN" | "CASH_OUT">("CASH_IN");
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTransactionFormInput>({
    resolver: zodResolver(createTransactionSchema),
    defaultValues: { type: "CASH_IN" },
  });

  const categories = type === "CASH_IN" ? CATEGORIES_IN : CATEGORIES_OUT;

  const onSubmit = async (data: CreateTransactionFormInput) => {
    setSubmitting(true);
    try {
      await apiFetch(`/api/cashbooks/${cashbookId}/transactions`, {
        method: "POST",
        body: JSON.stringify({ ...data, type, clientRequestId: nanoid() }),
      });
      toast.success(type === "CASH_IN" ? "Cash in recorded" : "Cash out recorded");
      reset();
      onClose();
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save transaction");
    } finally {
      setSubmitting(false);
    }
  };

  if (disabled) return null;

  return (
    <Drawer open={open} onClose={onClose} title="Add Cash" description="Record a cash movement in this cashbook.">
      <div className="mb-5 flex justify-center">
        <SegmentedControl
          options={[
            { value: "CASH_IN" as const, label: "Cash In" },
            { value: "CASH_OUT" as const, label: "Cash Out" },
          ]}
          value={type}
          onChange={setType}
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="amount">Amount</Label>
          <Input id="amount" type="number" step="0.01" min="0.01" autoFocus placeholder="5000" className="mt-1.5 text-lg" {...register("amount")} />
          <FieldError>{errors.amount?.message}</FieldError>
        </div>

        <div>
          <Label htmlFor="person">{type === "CASH_IN" ? "From" : "To"}</Label>
          <Input id="person" placeholder={type === "CASH_IN" ? "Rahul" : "Supplier"} className="mt-1.5" {...register("person")} />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Input id="description" placeholder="Payment for order" className="mt-1.5" {...register("description")} />
        </div>

        <div>
          <Label htmlFor="category">Category</Label>
          <select id="category" className="mt-1.5 h-11 w-full rounded-xl border border-border bg-surface-2 px-3.5 text-sm" {...register("category")}>
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" rows={2} placeholder="Optional notes" className="mt-1.5" {...register("notes")} />
        </div>

        <Button type="submit" size="lg" disabled={submitting} className="mt-2 w-full">
          {submitting ? "Saving…" : type === "CASH_IN" ? "Add Cash In" : "Add Cash Out"}
        </Button>
      </form>
    </Drawer>
  );
}
