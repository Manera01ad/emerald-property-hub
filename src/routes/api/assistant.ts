import { createFileRoute } from "@tanstack/react-router";
import { handleAssistantChat } from "@/lib/assistant/chat.server";

export const Route = createFileRoute("/api/assistant")({
  staticData: { sitemap: false },
  server: { handlers: { POST: ({ request }) => handleAssistantChat(request) } },
});
