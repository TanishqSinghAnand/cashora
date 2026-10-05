"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { createInvitationSchema, type CreateInvitationFormInput } from "@/validations/invitation";
import { apiFetch } from "@/lib/api-client";

export function InviteDrawer({ cashbookId, open, onClose }: { cashbookId: string; open: boolean; onClose: () => void }) {
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [invitedEmail, setInvitedEmail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateInvitationFormInput>({ resolver: zodResolver(createInvitationSchema), defaultValues: { permission: "EDIT" } });

  const onSubmit = async (data: CreateInvitationFormInput) => {
    setSubmitting(true);
    try {
      const res = await apiFetch<{ inviteLink: string }>(`/api/cashbooks/${cashbookId}/invitations`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      setInviteLink(res.inviteLink);
      setInvitedEmail(data.email);
      reset();
      toast.success("Invitation sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create invitation");
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    toast.success("Link copied");
  };

  return (
    <Drawer
      open={open}
      onClose={() => {
        setInviteLink(null);
        setInvitedEmail(null);
        onClose();
      }}
      title="Invite a collaborator"
      description="They'll be able to view and add transactions once they accept."
    >
      {inviteLink ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            We emailed <span className="font-medium text-foreground">{invitedEmail}</span> with this invite. You can
            also share the link directly:
          </p>
          <div className="flex gap-2">
            <Input readOnly value={inviteLink} className="text-xs" />
            <Button variant="outline" size="icon" onClick={copyLink} aria-label="Copy link">
              <Copy size={16} />
            </Button>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setInviteLink(null);
              setInvitedEmail(null);
            }}
          >
            Invite someone else
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="rahul@example.com" className="mt-1.5" {...register("email")} />
            <FieldError>{errors.email?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="permission">Permission</Label>
            <select id="permission" className="mt-1.5 h-11 w-full rounded-xl border border-border bg-surface-2 px-3.5 text-sm" {...register("permission")}>
              <option value="EDIT">Can add & edit transactions</option>
              <option value="VIEW">View only</option>
            </select>
          </div>
          <Button type="submit" size="lg" disabled={submitting} className="mt-2 w-full">
            {submitting ? "Creating…" : "Create Invite Link"}
          </Button>
        </form>
      )}
    </Drawer>
  );
}
