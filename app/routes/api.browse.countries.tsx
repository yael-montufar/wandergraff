import { type LoaderFunction } from "react-router";

export const loader: LoaderFunction = async () => {
  try {
    const { withPrisma } = await import("~/lib/db.server");
    const countries = await withPrisma(async (db) => {
      return await db.country.findMany({
        orderBy: [
          { artworkCount: "desc" },
          { name: "asc" },
        ],
      });
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
