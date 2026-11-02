import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DocumentScreen } from "./DocumentScreen";

describe("DocumentScreen", () => {
  it("shows a warning headline and a missing row when documents are not recorded", () => {
    render(<DocumentScreen listing={{ property_type: "apartment", verification_status: "unverified", doc_title_deed: true }} />);
    expect(screen.getByTestId("document-screen-headline")).toHaveTextContent(/4 of 5 key documents are not recorded/);
    expect(screen.getByTestId("document-check-doc_encumbrance")).toHaveTextContent("Missing");
    expect(screen.getByTestId("document-check-doc_title_deed")).toHaveTextContent("Recorded, not verified");
    expect(screen.getByTestId("document-check-doc_title_deed")).toHaveTextContent("Claim");
  });

  it("marks the building permit as not applicable on a plot", () => {
    render(<DocumentScreen listing={{ property_type: "plot", verification_status: "unverified" }} />);
    expect(screen.getByTestId("document-check-doc_building_permit")).toHaveTextContent("Not applicable");
    expect(screen.getByTestId("document-screen-headline")).toHaveTextContent(/4 of 4/);
  });
});
