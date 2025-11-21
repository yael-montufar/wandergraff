import { type LoaderFunction } from "react-router";

export const loader: LoaderFunction = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const artistId = url.searchParams.get("artistId");

    if (!artistId) {
      return new Response(JSON.stringify([]), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { withPrisma } = await import("~/lib/db.server");

    const artworks = await withPrisma(async (db) => {
      // First, check if this is an Artist table record (browse artist)
      const artist = await db.artist.findUnique({
        where: { id: artistId },
      });

      if (!artist) {
        return [];
      }

      // Find all users with this artist name who have claimed artworks
      const usersWithArtistName = await db.user.findMany({
        where: { artistName: artist.name },
        select: { id: true },
      });

      const userIds = usersWithArtistName.map((u) => u.id);

      // If no users have this artist name, return empty
      if (userIds.length === 0) {
        return [];
      }

      // Get artworks from those users
      return await db.artwork.findMany({
        where: {
          artistId: { in: userIds },
          claimStatus: "CLAIMED",
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
    });

    return new Response(JSON.stringify(artworks), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching artworks by artist:", error);
    return new Response(JSON.stringify([]), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
