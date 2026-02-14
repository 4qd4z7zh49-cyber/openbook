"use client";

import { supabase } from "@/lib/supabaseClient";

function normalizeClientAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lower = message.toLowerCase();

  if (lower.includes("supabasekey is required")) {
    return new Error("Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  if (lower.includes("supabase url is required")) {
    return new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
  }
  return error instanceof Error ? error : new Error(message || "Auth error");
}

export async function getUserAccessToken() {
  try {
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr) throw sessionErr;

    let token = sessionData.session?.access_token || "";
    if (token) return token;

    const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
    if (!refreshErr) {
      token = refreshed.session?.access_token || "";
      if (token) return token;
    }

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return "";

    const { data: latest } = await supabase.auth.getSession();
    return latest.session?.access_token || "";
  } catch (error) {
    throw normalizeClientAuthError(error);
  }
}

export async function getUserAuthHeaders(): Promise<Record<string, string>> {
  const token = await getUserAccessToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export function isUnauthorizedMessage(message: string) {
  const lower = String(message || "").toLowerCase();
  return (
    lower.includes("unauthorized") ||
    lower.includes("jwt") ||
    lower.includes("auth session missing")
  );
}
