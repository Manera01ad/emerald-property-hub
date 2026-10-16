import { createPublicClient } from "./public-client.server";

export async function publicPropertyIds(client = createPublicClient(), pageSize = 1000): Promise<string[]> {
  const ids: string[] = [];
  for (let offset = 0; ; ) {
    const { data, error } = await client.from("properties").select("id")
      .eq("status", "published").eq("listing_permission", true).eq("is_demo", false)
      .order("id").range(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!data) throw new Error("Public listing query returned no result");
    if (data.length === 0) return ids;
    ids.push(...data.map((row) => row.id));
    offset += data.length;
  }
}