import { describe, expect, it } from "vitest";
import { propertyVideos, youTubeEmbedUrl, youTubeId, youTubeThumbnailUrl } from "./video";

describe("youTubeId", () => {
  it("reads a standard watch link", () => {
    expect(youTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("reads a watch link with extra parameters", () => {
    expect(youTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL123")).toBe("dQw4w9WgXcQ");
  });

  it("reads a short youtu.be link", () => {
    expect(youTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youTubeId("https://youtu.be/dQw4w9WgXcQ?t=10")).toBe("dQw4w9WgXcQ");
  });

  it("reads embed, shorts and live links", () => {
    expect(youTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youTubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youTubeId("https://www.youtube.com/live/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("accepts a bare id", () => {
    expect(youTubeId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("accepts mobile and no-cookie hosts and a protocol-relative link", () => {
    expect(youTubeId("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youTubeId("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youTubeId("//youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("rejects empty, malformed and non-YouTube input", () => {
    expect(youTubeId(null)).toBeNull();
    expect(youTubeId("")).toBeNull();
    expect(youTubeId("   ")).toBeNull();
    expect(youTubeId("not a url")).toBeNull();
    expect(youTubeId("https://vimeo.com/123456789")).toBeNull();
    expect(youTubeId("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(youTubeId("javascript:alert(1)")).toBeNull();
    expect(youTubeId("https://www.youtube.com/watch?v=tooshort")).toBeNull();
    expect(youTubeId("dQw4w9WgXcQextra")).toBeNull();
  });

  it("does not treat a lookalike host as YouTube", () => {
    expect(youTubeId("https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(youTubeId("https://notyoutube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
  });
});

describe("embed and thumbnail urls", () => {
  it("builds a privacy-enhanced embed url", () => {
    expect(youTubeEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });

  it("returns null for an invalid link", () => {
    expect(youTubeEmbedUrl("https://vimeo.com/123456789")).toBeNull();
    expect(youTubeThumbnailUrl("")).toBeNull();
  });

  it("builds a thumbnail url for the click-to-play poster", () => {
    expect(youTubeThumbnailUrl("dQw4w9WgXcQ")).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });
});

describe("propertyVideos", () => {
  it("keeps valid links in order, drops invalid ones and removes duplicates", () => {
    const videos = propertyVideos([
      "https://youtu.be/dQw4w9WgXcQ",
      "https://vimeo.com/1",
      "https://www.youtube.com/watch?v=abcdefghijk",
      "https://youtu.be/dQw4w9WgXcQ",
    ]);
    expect(videos.map((v) => v.id)).toEqual(["dQw4w9WgXcQ", "abcdefghijk"]);
    expect(videos[0]?.embedUrl).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });

  it("handles null and undefined", () => {
    expect(propertyVideos(null)).toEqual([]);
    expect(propertyVideos(undefined)).toEqual([]);
    expect(propertyVideos([])).toEqual([]);
  });
});
