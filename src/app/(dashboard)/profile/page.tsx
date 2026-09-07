"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { useUser } from "@/components/providers/user-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";

export default function ProfilePage() {
  const { user } = useUser();
  const router = useRouter();

  const handleLogout = async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    toast.success("Signed out");
    router.push("/");
    router.refresh();
  };

  if (!user) return null;

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-8 flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>

      <Card>
        <CardContent className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/15 flex items-center justify-center text-2xl font-semibold text-primary">
            {user.name[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-lg">{user.name}</p>
            {user.telegramUsername && <p className="text-sm text-muted">@{user.telegramUsername}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Account type</span>
            <span>Telegram-verified</span>
          </div>
          {user.email && (
            <div className="flex justify-between">
              <span className="text-muted">Email</span>
              <span>{user.email}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Button variant="outline" onClick={handleLogout} className="self-start">
        <LogOut size={16} /> Sign out
      </Button>
    </div>
  );
}
