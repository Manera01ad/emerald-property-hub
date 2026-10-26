import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import mark from "@/assets/assistant-mark.png";
import { describeSearch, type SearchKind } from "@/lib/assistant/search-log";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({
    meta: [
      { title: "Ask PropWise — help assistant" },
      { name: "description", content: "Ask questions about using PropWise AI's property tools for Chennai." },
      { property: "og:title", content: "Ask PropWise — help assistant" },
      { property: "og:description", content: "Ask questions about using PropWise AI's property tools for Chennai." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AssistantPage,
});

const SUGGESTIONS = [
  "How do I estimate the full cost of buying a plot?",
  "How does the value estimate work?",
  "Why can't I see any listings?",
  "How do I compare two properties?",
];

function AssistantPage() {
  const [initial, setInitial] = useState<UIMessage[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    supabase
      .from("assistant_messages")
      .select("message")
      .order("created_at")
      .then(({ data, error }) => {
        if (error) setLoadError(true);
        setInitial((data ?? []).map((r) => r.message as unknown as UIMessage));
      });
  }, []);

  if (!initial) return <div className="mx-auto max-w-3xl px-4 py-16"><Shimmer>Loading your conversation…</Shimmer></div>;
  return <ChatWindow initial={initial} loadError={loadError} />;
}

function ChatWindow({ initial, loadError }: { initial: UIMessage[]; loadError: boolean }) {
  const [input, setInput] = useState("");
  const [cleared, setCleared] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/assistant",
        headers: async (): Promise<Record<string, string>> => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    [],
  );
  const { messages, sendMessage, status, stop, setMessages, error } = useChat({
    id: `assistant-${cleared}`,
    messages: cleared ? [] : initial,
    transport,
    onError: (e) => toast.error(readError(e)),
  });
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (!busy) textareaRef.current?.focus();
  }, [busy]);
  useEffect(() => {
    if (loadError) toast.error("Couldn't load your earlier messages.");
  }, [loadError]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    sendMessage({ text: t });
    setInput("");
  };

  const startOver = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { error: delError } = await supabase.from("assistant_messages").delete().eq("user_id", data.user.id);
    if (delError) { toast.error("Couldn't clear the conversation."); return; }
    setMessages([]);
    setCleared((c) => c + 1);
  };

  const last = messages[messages.length - 1];
  const waiting = busy && (!last || last.role === "user");

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-3xl flex-col px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src={mark} alt="" width={40} height={40} className="size-10" />
          <div>
            <h1 className="font-display text-2xl font-semibold text-primary">Ask PropWise</h1>
            <p className="text-xs text-muted-foreground">Help with using the site. Answers are general guidance, not legal advice.</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" size="sm" onClick={startOver} disabled={busy}>Start over</Button>
        )}
      </div>

      <Conversation className="flex-1 rounded-lg border bg-card">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState>
              <div className="mt-4 flex flex-col items-center gap-3">
                <img src={mark} alt="" width={64} height={64} className="size-16" />
                <p className="font-medium">What would you like to know?</p>
                <p className="text-sm text-muted-foreground">Ask how any PropWise tool works, or where to find something.</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <Button key={s} variant="outline" size="sm" onClick={() => send(s)}>{s}</Button>
                  ))}
                </div>
              </div>
            </ConversationEmptyState>
          ) : (
            messages.map((m) => (
              <Message key={m.id} from={m.role}>
                <MessageContent>
                  {m.parts.map((p, i) => {
                    if (p.type === "text") return m.role === "assistant" ? <MessageResponse key={i}>{p.text}</MessageResponse> : <span key={i} className="whitespace-pre-wrap">{p.text}</span>;
                    if (p.type === "reasoning" && p.text) return (
                      <Reasoning key={i} isStreaming={busy && m.id === last?.id && p.state === "streaming"}>
                        <ReasoningTrigger />
                        <ReasoningContent>{p.text}</ReasoningContent>
                      </Reasoning>
                    );
                    return null;
                  })}
                </MessageContent>
              </Message>
            ))
          )}
          {waiting && <Shimmer>Thinking…</Shimmer>}
          {error && !busy && <p className="text-sm text-destructive">{readError(error)}</p>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <PromptInput className="mt-3" onSubmit={(msg) => send(msg.text ?? "")}>
        <PromptInputTextarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.currentTarget.value)}
          placeholder="Ask about valuations, costs, the map…"
        />
        <PromptInputFooter className="justify-end">
          <PromptInputSubmit status={status} onStop={stop} disabled={!busy && !input.trim()} />
        </PromptInputFooter>
      </PromptInput>

      <SearchHistory busy={busy} />
    </div>
  );
}

type HistoryRow = {
  id: string;
  kind: SearchKind;
  query: Record<string, unknown>;
  result_count: number;
  sources: { title?: string; url?: string; id?: string }[];
  created_at: string;
};

/** Everything the assistant looked up for this user. The table is created by migration 0012. */
function SearchHistory({ busy }: { busy: boolean }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || busy) return;
    // Not in the generated types until the migration is applied and types are regenerated.
    const table = (supabase as unknown as { from: (t: string) => { select: (c: string) => { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => PromiseLike<{ data: HistoryRow[] | null; error: unknown }> } } } }).from("assistant_search_log");
    table
      .select("id,kind,query,result_count,sources,created_at")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        setFailed(!!error);
        setRows(data ?? []);
      });
  }, [open, busy]);

  const clear = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const table = (supabase as unknown as { from: (t: string) => { delete: () => { eq: (c: string, v: string) => PromiseLike<{ error: unknown }> } } }).from("assistant_search_log");
    const { error } = await table.delete().eq("user_id", data.user.id);
    if (error) { toast.error("Couldn't clear your search history."); return; }
    setRows([]);
  };

  return (
    <details className="mt-3 rounded-lg border bg-card text-sm" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer px-3 py-2 font-medium">Search history</summary>
      <div className="max-h-48 space-y-2 overflow-y-auto border-t px-3 py-2">
        {rows === null && !failed && <Shimmer>Loading…</Shimmer>}
        {failed && <p className="text-muted-foreground">Search history isn't available yet.</p>}
        {rows?.length === 0 && !failed && <p className="text-muted-foreground">Nothing yet. When the assistant looks something up for you, it appears here.</p>}
        {rows?.map((r) => (
          <div key={r.id} className="border-b pb-2 last:border-b-0">
            <p>{describeSearch(r)}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(r.created_at).toLocaleString("en-IN")} · {r.result_count} {r.result_count === 1 ? "result" : "results"}
            </p>
            {r.kind === "web" && r.sources.some((s) => s.url) && (
              <ul className="mt-1 space-y-0.5 text-xs">
                {r.sources.filter((s) => s.url).map((s, i) => (
                  <li key={i}><a className="text-primary underline" href={s.url} target="_blank" rel="noopener noreferrer">{s.title || s.url}</a></li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {!!rows?.length && <Button variant="outline" size="sm" onClick={clear}>Clear history</Button>}
      </div>
    </details>
  );
}

function readError(e: Error) {
  try {
    const parsed = JSON.parse(e.message) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch { /* not JSON */ }
  return e.message || "Something went wrong. Please try again.";
}
