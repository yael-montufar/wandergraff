import { type LoaderFunction } from "react-router";

interface ArtistsByLetter {
  [letter: string]: Array<{
    id: string;
    name: string;
    artworkCount: number;
  }>;
}

export const loader: LoaderFunction = async () => {
  try {
    const { withDirectPG } = await import("~/lib/db.server");
    const artists = await withDirectPG(async (client) => {
      const query = `
        SELECT "id", "name", "artworkCount", "createdAt", "updatedAt"
        FROM "Artist"
        ORDER BY "artworkCount" DESC, "name" ASC
      `;
      const result = await client.query(query);
      return result.rows;
    });

    // Group artists by first letter
    const grouped: ArtistsByLetter = {};

    for (const artist of artists) {
      const firstLetter = (artist.name.charAt(0) || "").toUpperCase();
      if (!grouped[firstLetter]) {
        grouped[firstLetter] = [];
      }
      grouped[firstLetter].push(artist);
    }

    return new Response(JSON.stringify(grouped), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching artists:", error);
    return new Response(JSON.stringify({}), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
