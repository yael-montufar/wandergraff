import { type LoaderFunction } from "react-router";

interface MapPin {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  address?: string;
  claimStatus: string;
  photoUrl?: string;
  artistName?: string;
  photos?: Array<{ photoUrl: string }>;
}

export const loader: LoaderFunction = async ({ request }) => {
  try {
    const { withDirectPG } = await import("~/lib/db.server");
    const url = new URL(request.url);

    // Parse viewport bounds from query parameters
    const minLat = url.searchParams.get("minLat");
    const maxLat = url.searchParams.get("maxLat");
    const minLng = url.searchParams.get("minLng");
    const maxLng = url.searchParams.get("maxLng");
    const zoom = url.searchParams.get("zoom");

    console.log("[API PINS] ====== PINS REQUEST ======");
    console.log("[API PINS] Full URL:", url.toString());
    console.log("[API PINS] Query params received:");
    console.log("[API PINS]   minLat:", minLat);
    console.log("[API PINS]   maxLat:", maxLat);
    console.log("[API PINS]   minLng:", minLng);
    console.log("[API PINS]   maxLng:", maxLng);
    console.log("[API PINS]   zoom:", zoom);

    // Build where clause for viewport filtering
    const where: any = {};
    let filterApplied = false;

    // Apply viewport filtering if bounds are provided
    if (minLat && maxLat && minLng && maxLng && zoom) {
      const zoomLevel = parseInt(zoom, 10);
      console.log("[API PINS] Zoom level parsed:", zoomLevel);

      // Always apply viewport filtering when bounds are provided
      filterApplied = true;
      where.AND = [
        { latitude: { gte: parseFloat(minLat) } },
        { latitude: { lte: parseFloat(maxLat) } },
        { longitude: { gte: parseFloat(minLng) } },
        { longitude: { lte: parseFloat(maxLng) } },
      ];
      console.log("[API PINS] ✅ FILTER APPLIED - Viewport bounds filter active");
      console.log("[API PINS] Filter details:", JSON.stringify(where, null, 2));
    } else {
      console.log("[API PINS] ❌ Filter NOT applied - missing query parameters");
      console.log("[API PINS] hasMinLat:", !!minLat, "hasMaxLat:", !!maxLat, "hasMinLng:", !!minLng, "hasMaxLng:", !!maxLng, "hasZoom:", !!zoom);
    }

    const pins = await withDirectPG(async (client) => {
      let query = `
        SELECT 
          a."id",
          a."latitude",
          a."longitude",
          a."title",
          a."address",
          a."claimStatus",
          artist."artistName",
          p."photoUrl"
        FROM "Artwork" a
        LEFT JOIN "User" artist ON a."artistId" = artist."id"
        LEFT JOIN LATERAL (
          SELECT "photoUrl" 
          FROM "Photo" 
          WHERE "artworkId" = a."id" 
          ORDER BY "uploadedAt" DESC 
          LIMIT 1
        ) p ON true
      `;
      
      const params: any[] = [];
      
      if (filterApplied && where.AND) {
        query += ` WHERE a."latitude" >= $1 AND a."latitude" <= $2 AND a."longitude" >= $3 AND a."longitude" <= $4`;
        params.push(
          parseFloat(minLat!),
          parseFloat(maxLat!),
          parseFloat(minLng!),
          parseFloat(maxLng!)
        );
      }
      
      const result = await client.query(query, params);
      const artworks = result.rows;

      console.log("[API PINS] Query executed, results:", artworks.length, "artworks");
      console.log("[API PINS] Filter was applied?", filterApplied);

      return artworks.map((artwork): MapPin => ({
        id: artwork.id,
        latitude: artwork.latitude,
        longitude: artwork.longitude,
        title: artwork.title,
        address: artwork.address || undefined,
        claimStatus: artwork.claimStatus,
        photoUrl: artwork.photoUrl,
        artistName: artwork.artistName,
        photos: artwork.photoUrl ? [{ photoUrl: artwork.photoUrl }] : [],
      }));
    });

    return new Response(JSON.stringify(pins), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching map pins:", error);
    return new Response(JSON.stringify([]), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
