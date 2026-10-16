import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getPublicPropertyMetadata = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    if (!z.uuid().safeParse(data.id).success) return null;
    const { createPublicClient } = await import("./public-client.server");
    const { data: property, error } = await createPublicClient().from("properties")
      .select("title,location,description,property_type")
      .eq("id", data.id).eq("status", "published")
      .eq("listing_permission", true).eq("is_demo", false).maybeSingle();
    if (error) throw error;
    return property;
  });