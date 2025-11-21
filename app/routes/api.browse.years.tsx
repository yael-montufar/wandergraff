import { type LoaderFunction } from "react-router";

export const loader: LoaderFunction = async () => {
  try {
    const { withPrisma } = await import("~/lib/db.server");
    const years = await withPrisma(async (db) => {
      return await db.artworkYear.findMany({
        orderBy: [
          { artworkCount: "desc" },
          { year: "desc" },
        ],
      });
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
