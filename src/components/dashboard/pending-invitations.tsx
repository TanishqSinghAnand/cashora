"use client";

import useSWR from "swr";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { fetcher, apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { PendingInvitation } from "@/types";

export function PendingInvitations() {
  const { data, mutate } = useSWR<{ invitations: PendingInvitation[] }>("/api/invitations", fetcher);
  const router = useRouter();
  const invitations = data?.invitations ?? [];

  if (invitations.length === 0) return null;

  const respond = async (token: string, action: "accept" | "decline") => {
    try {
      const res = await apiFetch<{ cashbookId?: string }>(`/api/invitations/${token}/${action}`, { method: "POST" });
      toast.success(action === "accept" ? "Invitation accepted" : "Invitation declined");
      mutate();
      if (action === "accept" && res.cashbookId) router.push(`/cashbooks/${res.cashbookId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <Card className="border-primary/30">
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm font-medium">Pending Invitations</p>
        {invitations.map((inv) => (
          <div key={inv.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 p-3">
            <p className="text-sm">
              <span className="font-medium">{inv.inviterName}</span> invited you to{" "}
              <span className="font-medium">{inv.cashbookName}</span>
            </p>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" onClick={() => respond(inv.token, "accept")}>
                Accept
              </Button>
              <Button size="sm" variant="outline" onClick={() => respond(inv.token, "decline")}>
                Decline
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
