"use client";

import { useEffect, useRef } from "react";

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

declare global {
  interface Window {
    onCashoraTelegramAuth?: (user: TelegramUser) => void;
  }
}

export function TelegramLoginWidget({
  botUsername,
  onAuth,
}: {
  botUsername: string;
  onAuth: (user: TelegramUser) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    window.onCashoraTelegramAuth = onAuth;

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "999");
    script.setAttribute("data-onauth", "onCashoraTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");

    container?.appendChild(script);

    return () => {
      delete window.onCashoraTelegramAuth;
      container?.replaceChildren();
    };
  }, [botUsername, onAuth]);

  return <div ref={containerRef} className="flex justify-center" />;
}
