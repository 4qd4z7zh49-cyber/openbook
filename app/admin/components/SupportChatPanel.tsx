"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ThreadStatus = "OPEN" | "CLOSED";
type SenderRole = "USER" | "ADMIN";
type MessageType = "TEXT" | "IMAGE";

type SupportThread = {
  id: string;
  userId: string;
  adminId: string | null;
  username: string | null;
  email: string | null;
  adminUsername: string | null;
  status: ThreadStatus;
  lastSender: SenderRole;
  lastMessageAt: string;
  createdAt: string;
  needsReply: boolean;
};

type SupportMessage = {
  id: string;
  threadId: string;
  senderRole: SenderRole;
  senderUserId: string | null;
  senderAdminId: string | null;
  message: string;
  messageType: MessageType;
  imageUrl: string | null;
  createdAt: string;
};

type SupportListResponse = {
  ok?: boolean;
  error?: string;
  pendingCount?: number;
  activeThreadId?: string | null;
  threads?: SupportThread[];
  messages?: SupportMessage[];
};

type UserRow = {
  id: string;
  username?: string | null;
  email?: string | null;
};

type UsersResp = {
  users?: UserRow[];
  error?: string;
};

type SupportSendResponse = {
  ok?: boolean;
  error?: string;
  pendingCount?: number;
  message?: SupportMessage;
  thread?: {
    id: string;
    userId?: string | null;
  };
};

async function readJson<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    return {} as T;
  }
}

function fmtWhen(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString();
}

function statusLabel(status: ThreadStatus) {
  return status === "OPEN" ? "Active" : "Closed";
}

function messageImageName(message: SupportMessage) {
  const ts = new Date(message.createdAt || Date.now()).getTime();
  return `openbookpro-support-${Number.isFinite(ts) ? ts : Date.now()}.png`;
}

function downloadImage(url: string, name: string) {
  if (!url) return;
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}

export default function SupportChatPanel() {
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [activeThreadId, setActiveThreadId] = useState("");
  const [composeUserId, setComposeUserId] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersErr, setUsersErr] = useState("");
  const [listErr, setListErr] = useState("");
  const [draft, setDraft] = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  const [sendErr, setSendErr] = useState("");
  const [pickedImageDataUrl, setPickedImageDataUrl] = useState("");
  const [pickedImageName, setPickedImageName] = useState("");
  const [imageMenuId, setImageMenuId] = useState("");
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [previewImageName, setPreviewImageName] = useState("");
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const activeThreadIdRef = useRef("");
  const loadSeqRef = useRef(0);
  const focusUserIdRef = useRef("");
  const prevThreadRef = useRef("");
  const prevMessageCountRef = useRef(0);

  const activeThread = useMemo(
    () => threads.find((row) => row.id === activeThreadId) || null,
    [threads, activeThreadId]
  );

  const hasExistingThreadForComposeUser = useMemo(() => {
    if (!composeUserId) return false;
    return threads.some((t) => t.userId === composeUserId);
  }, [composeUserId, threads]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersErr("");
    try {
      const r = await fetch("/api/admin/users", {
        cache: "no-store",
        credentials: "include",
      });
      const j = await readJson<UsersResp>(r);
      if (!r.ok) {
        throw new Error(j?.error || "Failed to load users");
      }
      const nextUsers = Array.isArray(j.users) ? j.users : [];
      setUsers(nextUsers);
      setComposeUserId((prev) => prev || nextUsers[0]?.id || "");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load users";
      setUsersErr(message);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const loadData = useCallback(async (opts?: { threadId?: string; userId?: string; silent?: boolean }) => {
    const threadId = String(opts?.threadId || "");
    const directUserId = String(opts?.userId || "");
    const silent = Boolean(opts?.silent);
    const seq = ++loadSeqRef.current;
    if (!silent) {
      setLoading(true);
    }
    setListErr("");
    try {
      const params = new URLSearchParams();
      params.set("limit", "250");
      const target = threadId || activeThreadIdRef.current;
      if (target) params.set("threadId", target);
      const targetUserId = directUserId || (target ? "" : focusUserIdRef.current);
      if (targetUserId) params.set("userId", targetUserId);

      const r = await fetch(`/api/admin/support?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });
      const j = await readJson<SupportListResponse>(r);
      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || "Failed to load support chats");
      }
      if (seq !== loadSeqRef.current) return;

      const nextThreads = Array.isArray(j.threads) ? j.threads : [];
      const nextMessages = Array.isArray(j.messages) ? j.messages : [];
      const nextActive = String(j.activeThreadId || "");

      setThreads(nextThreads);
      setMessages(nextMessages);
      setPendingCount(Number(j.pendingCount ?? 0));
      setActiveThreadId((prev) => {
        if (threadId && nextThreads.some((row) => row.id === threadId)) return threadId;
        if (prev && nextThreads.some((row) => row.id === prev)) return prev;
        if (nextActive && nextThreads.some((row) => row.id === nextActive)) return nextActive;
        return nextThreads[0]?.id || "";
      });
    } catch (e: unknown) {
      if (seq !== loadSeqRef.current) return;
      const message = e instanceof Error ? e.message : "Failed to load support chats";
      setListErr(message);
    } finally {
      if (!silent && seq === loadSeqRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

  useEffect(() => {
    void loadData();
    void loadUsers();
  }, [loadData, loadUsers]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadData({ silent: true });
    }, 3000);
    return () => window.clearInterval(timer);
  }, [loadData]);

  useEffect(() => {
    const node = bodyRef.current;
    if (!node) return;

    const threadChanged = prevThreadRef.current !== activeThreadId;
    const countIncreased = messages.length > prevMessageCountRef.current;
    const nearBottom = node.scrollHeight - (node.scrollTop + node.clientHeight) < 80;

    if (threadChanged || countIncreased || nearBottom) {
      node.scrollTop = node.scrollHeight;
    }

    prevThreadRef.current = activeThreadId;
    prevMessageCountRef.current = messages.length;
  }, [messages.length, activeThreadId]);

  useEffect(() => {
    const closeMenu = () => setImageMenuId("");
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  }, []);

  useEffect(() => {
    if (!activeThread) return;
    setComposeUserId(activeThread.userId);
  }, [activeThread]);

  useEffect(() => {
    if (!users.length) {
      setComposeUserId("");
      return;
    }
    if (composeUserId && users.some((u) => u.id === composeUserId)) return;
    setComposeUserId(users[0].id);
  }, [users, composeUserId]);

  const selectThread = (threadId: string) => {
    if (!threadId) return;
    focusUserIdRef.current = "";
    setActiveThreadId(threadId);
    activeThreadIdRef.current = threadId;
    setSendErr("");
    setImageMenuId("");
    void loadData({ threadId, silent: true });
  };

  const openOrPrepareUserChat = () => {
    if (!composeUserId) return;
    const existing = threads.find((row) => row.userId === composeUserId);
    if (existing) {
      selectThread(existing.id);
      return;
    }
    focusUserIdRef.current = composeUserId;
    setActiveThreadId("");
    activeThreadIdRef.current = "";
    setMessages([]);
    setSendErr("");
    void loadData({ userId: composeUserId, silent: true });
  };

  const onPickPhoto = () => {
    fileRef.current?.click();
  };

  const onPhotoChanged = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setSendErr("Only image files are allowed");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setSendErr("Image size must be 2MB or less");
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setPickedImageDataUrl(dataUrl);
      setPickedImageName(file.name);
      setSendErr("");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to read image";
      setSendErr(message);
    }
  };

  const clearPhoto = () => {
    setPickedImageDataUrl("");
    setPickedImageName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const onSend = async () => {
    const message = draft.trim();
    const targetThreadId = String(activeThreadIdRef.current || "");
    const targetUserId = String(composeUserId || activeThread?.userId || "");

    if (!targetThreadId && !targetUserId) {
      setSendErr("Choose a user first");
      return;
    }
    if (!message && !pickedImageDataUrl) {
      setSendErr("Message or photo is required");
      return;
    }
    if (message.length > 4000) {
      setSendErr("Message is too long (max 4000)");
      return;
    }

    setSendLoading(true);
    setSendErr("");
    try {
      const r = await fetch("/api/admin/support", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: targetThreadId || undefined,
          userId: targetThreadId ? undefined : targetUserId,
          message,
          imageDataUrl: pickedImageDataUrl || undefined,
        }),
      });
      const j = await readJson<SupportSendResponse>(r);
      if (!r.ok || !j?.ok || !j.message) {
        throw new Error(j?.error || "Failed to send message");
      }

      setDraft("");
      clearPhoto();
      setPendingCount(Number(j.pendingCount ?? pendingCount));
      const nextThreadId = String(j.thread?.id || targetThreadId || "");
      if (nextThreadId) {
        focusUserIdRef.current = "";
        setActiveThreadId(nextThreadId);
        activeThreadIdRef.current = nextThreadId;
      }
      if (nextThreadId && j.message) {
        setMessages((prev) => [...prev, j.message as SupportMessage]);
      }
    } catch (e: unknown) {
      const messageText = e instanceof Error ? e.message : "Failed to send message";
      setSendErr(messageText);
    } finally {
      setSendLoading(false);
      void loadData({
        threadId: String(activeThreadIdRef.current || ""),
        silent: true,
      });
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="mb-4 flex items-center gap-2">
        <div className="text-xl font-semibold">Openbookpro Client Support</div>
        <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-rose-500 px-2 py-0.5 text-xs font-semibold text-white">
          {pendingCount}
        </span>
      </div>
      <div className="mb-4 text-xs text-white/50">Auto-sync every 3s</div>

      {listErr ? <div className="mb-3 text-sm text-red-300">{listErr}</div> : null}

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="mb-2 text-sm font-semibold text-white">User Conversations</div>

          <div className="max-h-[65vh] space-y-2 overflow-auto pr-1">
            {threads.map((thread) => {
              const active = thread.id === activeThreadId;
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => selectThread(thread.id)}
                  className={[
                    "w-full rounded-xl border px-3 py-2 text-left",
                    active
                      ? "border-blue-400/50 bg-blue-500/15 text-white"
                      : "border-white/10 bg-black/20 text-white/85 hover:bg-black/30",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">{thread.username || "User"}</div>
                      <div className="mt-0.5 text-xs text-white/60">{thread.email || "-"}</div>
                    </div>
                    {thread.needsReply ? (
                      <span className="rounded-full border border-amber-300/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                        Unread
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-[11px] text-white/50">{fmtWhen(thread.lastMessageAt)}</div>
                </button>
              );
            })}

            {!loading && threads.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/60">
                No support messages yet.
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="mb-3 rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs text-white/60">Start / send to user</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                value={composeUserId}
                onChange={(e) => setComposeUserId(e.target.value)}
                className="min-w-[230px] flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
              >
                {users.length === 0 ? (
                  <option value="" className="bg-[#101216] text-white">
                    No users found
                  </option>
                ) : null}
                {users.map((u) => (
                  <option key={u.id} value={u.id} className="bg-[#101216] text-white">
                    {(u.username || "User") + (u.email ? ` (${u.email})` : "")}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={openOrPrepareUserChat}
                disabled={!composeUserId}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/90 hover:bg-white/10 disabled:opacity-60"
              >
                {hasExistingThreadForComposeUser ? "Open Chat" : "Start New Chat"}
              </button>
            </div>
            {usersLoading ? <div className="mt-2 text-xs text-white/50">Loading users...</div> : null}
            {usersErr ? <div className="mt-2 text-xs text-red-300">{usersErr}</div> : null}
          </div>

          {activeThread ? (
            <>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <div className="text-base font-semibold text-white">
                    {activeThread.username || "User"}
                  </div>
                  <div className="text-sm text-white/60">{activeThread.email || "-"}</div>
                </div>
                <div className="text-right text-xs text-white/60">
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1 text-emerald-200">
                    {statusLabel(activeThread.status)}
                  </div>
                  <div className="mt-1 text-white/45">Reply within working hours</div>
                </div>
              </div>

              <div
                ref={bodyRef}
                className="max-h-[56vh] space-y-3 overflow-auto rounded-xl border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.08),_rgba(17,24,39,0.85)_40%,_rgba(10,10,14,1)_80%)] p-3"
              >
                {messages.map((row) => {
                  const mine = row.senderRole === "ADMIN";
                  return (
                    <div key={row.id} className={["flex", mine ? "justify-end" : "justify-start"].join(" ")}>
                      <div
                        className={[
                          "relative max-w-[90%] rounded-2xl px-3 py-2 text-sm",
                          mine
                            ? "bg-blue-600 text-white shadow-[0_8px_20px_rgba(37,99,235,0.35)]"
                            : "border border-white/10 bg-[#1d1f25] text-white/90",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "absolute top-3 h-3 w-3 rotate-45",
                            mine
                              ? "-right-1.5 bg-blue-600"
                              : "-left-1.5 border-l border-t border-white/10 bg-[#1d1f25]",
                          ].join(" ")}
                          aria-hidden="true"
                        />

                        {row.messageType === "IMAGE" && row.imageUrl ? (
                          <div className="relative mb-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setImageMenuId((prev) => (prev === row.id ? "" : row.id));
                              }}
                              className="absolute right-2 top-2 z-10 rounded-lg border border-black/25 bg-black/45 px-2 py-0.5 text-xs text-white/90"
                            >
                              ...
                            </button>

                            {imageMenuId === row.id ? (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-2 top-9 z-20 w-32 overflow-hidden rounded-lg border border-white/20 bg-[#111827] text-xs text-white shadow-[0_14px_30px_rgba(0,0,0,0.45)]"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPreviewImageUrl(row.imageUrl || "");
                                    setPreviewImageName(messageImageName(row));
                                    setImageMenuId("");
                                  }}
                                  className="block w-full px-3 py-2 text-left hover:bg-white/10"
                                >
                                  Preview
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    downloadImage(row.imageUrl || "", messageImageName(row));
                                    setImageMenuId("");
                                  }}
                                  className="block w-full px-3 py-2 text-left hover:bg-white/10"
                                >
                                  Download
                                </button>
                              </div>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => {
                                setPreviewImageUrl(row.imageUrl || "");
                                setPreviewImageName(messageImageName(row));
                              }}
                              className="block rounded-xl"
                            >
                              <img
                                src={row.imageUrl}
                                alt="chat image"
                                className="max-h-72 w-auto max-w-full rounded-xl border border-white/20 object-contain"
                              />
                            </button>
                          </div>
                        ) : null}

                        {row.message ? (
                          <div className="whitespace-pre-wrap break-words">{row.message}</div>
                        ) : null}

                        <div
                          className={[
                            "mt-1 flex items-center justify-end gap-1 text-[10px]",
                            mine ? "text-blue-100/80" : "text-white/50",
                          ].join(" ")}
                        >
                          <span>{fmtWhen(row.createdAt)}</span>
                          {mine ? <span>• Sent</span> : null}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {!loading && messages.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/60">
                    No messages yet.
                  </div>
                ) : null}
              </div>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void onPhotoChanged(e.target.files?.[0])}
              />

              {pickedImageDataUrl ? (
                <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="mb-2 text-xs text-white/60">{pickedImageName || "Selected photo"}</div>
                  <img
                    src={pickedImageDataUrl}
                    alt="preview"
                    className="max-h-40 rounded-lg border border-white/10 object-contain"
                  />
                  <button
                    type="button"
                    onClick={clearPhoto}
                    className="mt-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80"
                  >
                    Remove Photo
                  </button>
                </div>
              ) : null}

              <div className="mt-3">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  placeholder="Type your reply..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!sendLoading) void onSend();
                    }
                  }}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none"
                />
                {sendErr ? <div className="mt-2 text-sm text-red-300">{sendErr}</div> : null}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={onPickPhoto}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10"
                  >
                    + Photo
                  </button>
                  <button
                    type="button"
                    disabled={sendLoading || (!draft.trim() && !pickedImageDataUrl)}
                    onClick={() => void onSend()}
                    className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {sendLoading ? "Sending..." : "Send Reply"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-4 text-sm text-white/70">
              No opened thread. Choose a user above and send a message to create a new chat.
            </div>
          )}
        </div>
      </div>

      {previewImageUrl ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/80 p-4 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Close image preview"
            onClick={() => setPreviewImageUrl("")}
            className="absolute inset-0"
          />
          <div className="relative z-[81] w-full max-w-3xl rounded-2xl border border-white/15 bg-[#090b11] p-3">
            <img
              src={previewImageUrl}
              alt="preview full"
              className="max-h-[72vh] w-full rounded-xl object-contain"
            />
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  downloadImage(previewImageUrl, previewImageName || `openbookpro-${Date.now()}.png`)
                }
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90"
              >
                Download
              </button>
              <button
                type="button"
                onClick={() => setPreviewImageUrl("")}
                className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
