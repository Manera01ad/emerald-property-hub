import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FloodPanel } from "./FloodPanel";
import { floodBrief } from "@/lib/flood";

describe("FloodPanel", () => {
  it("shows the not-a-verdict headline, unknowns and ground checks even with no data", () => {
    const brief = floodBrief({ elevation_m: null, mappedWaterCount: null, nearestWaterKm: null, officialZone: null });
    render(<FloodPanel brief={brief} area="Guduvancheri" />);
    expect(screen.getByTestId("flood-headline")).toHaveTextContent(/not a flood-risk verdict/);
    expect(screen.getByTestId("flood-fact-elevation")).toHaveTextContent("Unknown");
    expect(screen.getByText("What we do not know about Guduvancheri")).toBeInTheDocument();
    expect(screen.getByTestId("flood-ground-checks").querySelectorAll("li").length).toBe(brief.groundChecks.length);
  });

  it("labels held figures as estimates", () => {
    const brief = floodBrief({ elevation_m: 8, mappedWaterCount: 5, nearestWaterKm: 0.3, officialZone: null });
    render(<FloodPanel brief={brief} area="Tambaram" />);
    expect(screen.getByTestId("flood-fact-elevation")).toHaveTextContent("8 m");
    expect(screen.getByTestId("flood-fact-elevation")).toHaveTextContent("Estimate");
    expect(screen.getByTestId("flood-fact-official_zone")).toHaveTextContent("Unknown");
  });
});
