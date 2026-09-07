"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetcher, apiFetch, ApiError } from "@/lib/api-client";

interface InvitationInfo {
  cashbookName: string;
  inviterName: string;
  permission: string;
  status: string;
}

export default function InviteAcceptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
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

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        <Logo />
        <Card className="w-full">
          <CardContent className="flex flex-col items-center text-center gap-4 py-8">
            {isLoading ? (
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
                <div className="flex gap-3 w-full mt-2">
                  <Button className="flex-1" onClick={() => respond("accept")}>
                    Accept
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => respond("decline")}>
                    Decline
                  </Button>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
