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

    const { extractCountryFromCoordinates } = await import("~/lib/geocoding.server");
    
    const { country, artworks } = await withPrisma(async (db) => {
      // Get the country name from Country table
      const country = await db.country.findUnique({
        where: { id: countryId },
      });

      if (!country) {
        return { country: null, artworks: [] };
      }

      // First try to find artworks by address containing the country name (fast)
      let artworks = await db.artwork.findMany({
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

      // If no results from address search, fall back to geocoding approach
      // This handles cases where address format doesn't match country name
      if (artworks.length === 0) {
        console.log(`[COUNTRY] No artworks found by address for ${country.name}, trying geocoding approach`);
        
        const allArtworks = await db.artwork.findMany({
          select: {
            id: true,
            latitude: true,
            longitude: true,
            title: true,
            address: true,
            claimStatus: true,
            createdAt: true,
            artist: {
              select: {
                id: true,
                name: true,
                artistName: true,
              },
            },
            photos: {
              take: 1,
              select: {
                photoUrl: true,
              },
              orderBy: {
                uploadedAt: "desc",
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        // Filter by geocoding (only if address search failed)
        const matchingArtworks = [];
        for (const artwork of allArtworks) {
          try {
            const artworkCountry = await extractCountryFromCoordinates(
              artwork.latitude, 
              artwork.longitude
            );
            if (artworkCountry === country.name) {
              matchingArtworks.push(artwork);
            }
          } catch (error) {
            // Skip artworks that can't be geocoded
            console.error(`Failed to geocode artwork ${artwork.id}:`, error);
          }
        }
        
        artworks = matchingArtworks;
        console.log(`[COUNTRY] Found ${artworks.length} artworks by geocoding for ${country.name}`);
      } else {
        console.log(`[COUNTRY] Found ${artworks.length} artworks by address search for ${country.name}`);
      }

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
