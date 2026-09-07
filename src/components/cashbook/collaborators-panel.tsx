"use client";

import { useState } from "react";
import { UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { InviteDrawer } from "./invite-drawer";
import type { CollaboratorInfo } from "@/types";

export function CollaboratorsPanel({
  cashbookId,
  owner,
  collaborators,
  isOwner,
  onChange,
}: {
  cashbookId: string;
  owner: { id: string; name: string; photoUrl: string | null } | null;
  collaborators: CollaboratorInfo[];
  isOwner: boolean;
  onChange: () => void;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);

  const remove = async (userId: string) => {
    if (!confirm("Remove this collaborator?")) return;
    try {
      await apiFetch(`/api/cashbooks/${cashbookId}/collaborators/${userId}`, { method: "DELETE" });
      toast.success("Collaborator removed");
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove collaborator");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Collaborators</p>
        {isOwner && (
          <Button variant="outline" size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus size={14} /> Invite
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {owner && (
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
              {owner.name[0]?.toUpperCase()}
            </div>
            <p className="text-sm flex-1 truncate">{owner.name}</p>
            <span className="text-xs text-muted">Owner</span>
          </div>
        )}
        {collaborators.map((c) => (
          <div key={c.id} className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-surface-2 flex items-center justify-center text-xs font-semibold shrink-0">
              {c.name[0]?.toUpperCase()}
            </div>
            <p className="text-sm flex-1 truncate">{c.name}</p>
            <span className="text-xs text-muted">{c.permission === "EDIT" ? "Can edit" : "View only"}</span>
            {isOwner && (
              <button onClick={() => remove(c.userId)} aria-label="Remove collaborator" className="p-1 rounded-md hover:bg-surface-2 text-muted">
                <UserMinus size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      <InviteDrawer cashbookId={cashbookId} open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
