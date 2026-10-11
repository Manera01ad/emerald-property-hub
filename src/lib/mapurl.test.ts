import { describe, expect, it } from "vitest";
import { parseLocationInput, validLatLng } from "./mapurl";

describe("parseLocationInput", () => {
  it("reads @lat,lng links", () => {
    const r = parseLocationInput("https://www.google.com/maps/@13.0827,80.2707,15z");
    expect(r).toEqual({ ok: true, point: { lat: 13.0827, lng: 80.2707 } });
  });
  it("prefers the place pin (!3d!4d) over the camera", () => {
    const r = parseLocationInput("https://www.google.com/maps/place/X/@13.1,80.1,15z/data=!3d12.9!4d80.22");
    expect(r).toEqual({ ok: true, point: { lat: 12.9, lng: 80.22 } });
  });
  it("reads q= links and plain coordinates", () => {
    expect(parseLocationInput("https://maps.google.com/?q=12.97,80.25")).toEqual({ ok: true, point: { lat: 12.97, lng: 80.25 } });
    expect(parseLocationInput("13.05, 80.2")).toEqual({ ok: true, point: { lat: 13.05, lng: 80.2 } });
  });
  it("rejects short links, non-Google links and out-of-range values", () => {
    expect(parseLocationInput("https://maps.app.goo.gl/abc").ok).toBe(false);
    expect(parseLocationInput("https://evil.com/maps/@13,80").ok).toBe(false);
    expect(parseLocationInput("95, 80").ok).toBe(false);
  });
  it("treats missing or 0,0 coordinates as no location", () => {
    expect(validLatLng(null, null)).toBeNull();
    expect(validLatLng(0, 0)).toBeNull();
  });
});
