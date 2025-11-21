import { type LoaderFunction } from "react-router";

export const loader: LoaderFunction = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const countryId = url.searchParams.get("countryId");

    if (!countryId) {
      return new Response(JSON.stringify([]), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { withPrisma } = await import("~/lib/db.server");

    const { country, artworks } = await withPrisma(async (db) => {
      // Get the country name from Country table
      const country = await db.country.findUnique({
        where: { id: countryId },
      });

      if (!country) {
        return { country: null, artworks: [] };
      }

      // Find all artworks (any status) with this country in their address
      const artworks = await db.artwork.findMany({
        where: {
          address: {
            contains: country.name,
            mode: "insensitive",
          },
        },
        include: {
          artist: true,
          photos: {
            take: 1,
            orderBy: {
              uploadedAt: "desc",
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return { country, artworks };
    });

    if (!country) {
      return new Response(JSON.stringify([]), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(artworks), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching artworks by country:", error);
    return new Response(JSON.stringify([]), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
