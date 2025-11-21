import { type LoaderFunction } from "react-router";

export const loader: LoaderFunction = async () => {
  try {
    const { withDirectPG } = await import("~/lib/db.server");
    const years = await withDirectPG(async (client) => {
      const query = `
        SELECT "id", "year", "artworkCount", "createdAt", "updatedAt"
        FROM "ArtworkYear"
        ORDER BY "artworkCount" DESC, "year" DESC
      `;
      const result = await client.query(query);
      return result.rows;
    });

    return new Response(JSON.stringify(years), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching years:", error);
    return new Response(JSON.stringify([]), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
