import { type LoaderFunction } from "react-router";

export const loader: LoaderFunction = async () => {
  try {
    const { withDirectPG } = await import("~/lib/db.server");
    const countries = await withDirectPG(async (client) => {
      const query = `
        SELECT "id", "name", "code", "artworkCount", "createdAt", "updatedAt"
        FROM "Country"
        ORDER BY "artworkCount" DESC, "name" ASC
      `;
      const result = await client.query(query);
      return result.rows;
    });

    return new Response(JSON.stringify(countries), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching countries:", error);
    return new Response(JSON.stringify([]), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
