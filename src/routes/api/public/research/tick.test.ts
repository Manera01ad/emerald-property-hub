import { describe, expect, it } from "vitest";
import { Route } from "@/routes/api/public/research/tick";

/**
 * The tick route is called hourly by the database scheduler and is the only way
 * the research pipeline runs. It is exercised here as the route object the
 * framework actually registers, so a change to the handlers fails this test.
 *
 * Regression guarded: before the GET handler existed, a GET fell through to the
 * single-page-app fallback and answered 200 with HTML. A scheduler or uptime
 * check pointed at this address with the wrong method then looked healthy while
 * never running an agent.
 */

type HandlerContext = { request: Request };
type Handler = (ctx: HandlerContext) => Promise<Response> | Response;

const handlers = (
  Route as unknown as { options: { server: { handlers: Record<string, Handler> } } }
).options.server.handlers;

const URL = "https://emerald-property-hub.lovable.app/api/public/research/tick";

function call(method: string, init?: RequestInit): Promise<Response> | Response {
  const handler = handlers[method];
  if (!handler) throw new Error(`No ${method} handler registered on the tick route`);
  return handler({ request: new Request(URL, init) });
}

describe("research tick route", () => {
  it("registers a POST handler and a GET method guard", () => {
    expect(Object.keys(handlers).sort()).toEqual(["GET", "POST"]);
  });

  it("answers GET with 405 and names POST as the allowed method", async () => {
    const response = (await call("GET")) as Response;
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });

  it("does not answer GET with the HTML app shell", async () => {
    const response = (await call("GET")) as Response;
    const body = await response.text();
    expect(body).not.toMatch(/<!DOCTYPE html/i);
  });

  it("rejects a POST with no Authorization header as 401", async () => {
    const response = (await call("POST")) as Response;
    expect(response.status).toBe(401);
  });

  it("rejects a POST whose token is not 64 hex characters as 401", async () => {
    const response = (await call("POST", { headers: { authorization: "Bearer not-a-real-token" } })) as Response;
    expect(response.status).toBe(401);
  });
});
