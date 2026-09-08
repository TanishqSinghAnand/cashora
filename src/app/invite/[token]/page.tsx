"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetcher, apiFetch, ApiError } from "@/lib/api-client";
import { useUser } from "@/components/providers/user-provider";

interface InvitationInfo {
  cashbookName: string;
  inviterName: string;
  permission: string;
  status: string;
  invitedEmail: string | null;
}

export default function InviteAcceptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const { user, isLoading: userLoading } = useUser();
  const { data, error, isLoading } = useSWR<InvitationInfo>(`/api/invitations/${token}`, fetcher, { shouldRetryOnError: false });

  const respond = async (action: "accept" | "decline") => {
    try {
      const res = await apiFetch<{ cashbookId?: string }>(`/api/invitations/${token}/${action}`, { method: "POST" });
      toast.success(action === "accept" ? "You're in!" : "Invitation declined");
      router.push(action === "accept" && res.cashbookId ? `/cashbooks/${res.cashbookId}` : "/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const emailMismatch = Boolean(user && data?.invitedEmail && user.email && user.email.toLowerCase() !== data.invitedEmail.toLowerCase());

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        <Logo />
        <Card className="w-full">
          <CardContent className="flex flex-col items-center text-center gap-4 py-8">
            {isLoading || userLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : error ? (
              <p className="text-sm text-muted">
                {error instanceof ApiError ? error.message : "This invitation could not be found."}
              </p>
            ) : data ? (
              <>
                <p className="text-sm">
                  <span className="font-medium">{data.inviterName}</span> invited you to collaborate on
                </p>
                <p className="text-xl font-semibold tracking-tight">{data.cashbookName}</p>
                {data.invitedEmail && (
                  <p className="text-xs text-muted">
                    Sent to <span className="font-medium">{data.invitedEmail}</span> — sign in with that email to accept.
                  </p>
                )}

                {emailMismatch && (
                  <div className="flex items-start gap-2 text-left text-xs text-cash-out bg-cash-out/10 rounded-lg p-3">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    You&apos;re signed in as {user?.email}, not {data.invitedEmail}. Sign out and back in with the
                    right email to accept.
                  </div>
                )}

                {!user ? (
                  <Link href={`/login?next=/invite/${token}`} className={buttonVariants({ className: "w-full mt-2" })}>
                    Sign in to respond
                  </Link>
                ) : (
                  <div className="flex gap-3 w-full mt-2">
                    <Button className="flex-1" onClick={() => respond("accept")} disabled={emailMismatch}>
                      Accept
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => respond("decline")}>
                      Decline
                    </Button>
                  </div>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
