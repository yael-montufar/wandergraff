import { withPrisma } from "./db.server";

export async function createCollection(
  userId: string,
  name: string,
  options?: {
    description?: string;
    isPublic?: boolean;
  }
) {
  return await withPrisma(async (prisma) => {
    return await prisma.collection.create({
      data: {
        userId,
        name,
        description: options?.description,
        isPublic: options?.isPublic ?? false,
      },
    });
  });
}

export async function getCollection(id: string) {
  return await withPrisma(async (prisma) => {
    return await prisma.collection.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      },
      items: {
        include: {
          artwork: {
            include: {
              createdBy: {
                select: {
                  id: true,
                  name: true,
                },
              },
              artist: {
                select: {
                  id: true,
                  name: true,
                },
              },
              photos: {
                where: { isPrivate: false },
                take: 1,
                orderBy: { takenAt: "desc" },
              },
            },
          },
        },
        orderBy: { addedAt: "desc" },
      },
    },
    });
  });
}

export async function updateCollection(
  id: string,
  data: {
    name?: string;
    description?: string;
    isPublic?: boolean;
  }
) {
  return await withPrisma(async (prisma) => {
    return await prisma.collection.update({
      where: { id },
      data,
    });
  });
}

export async function deleteCollection(id: string) {
  return await withPrisma(async (prisma) => {
    return await prisma.collection.delete({
      where: { id },
    });
  });
}

export async function addArtworkToCollection(
  collectionId: string,
  artworkId: string
) {
  return await withPrisma(async (prisma) => {
    // Use upsert to make it idempotent - if already exists, just return it
    return await prisma.collectionItem.upsert({
      where: {
        collectionId_artworkId: {
          collectionId,
          artworkId,
        },
      },
      update: {},
      create: {
        collectionId,
        artworkId,
      },
    });
  });
}

export async function removeArtworkFromCollection(
  collectionId: string,
  artworkId: string
) {
  return await withPrisma(async (prisma) => {
    return await prisma.collectionItem.deleteMany({
      where: {
        collectionId,
        artworkId,
      },
    });
  });
}

export async function isArtworkInCollection(
  collectionId: string,
  artworkId: string
) {
  return await withPrisma(async (prisma) => {
    const item = await prisma.collectionItem.findUnique({
      where: {
        collectionId_artworkId: {
          collectionId,
          artworkId,
        },
      },
    });

    return !!item;
  });
}

export async function getUserCollections(userId: string) {
  return await withPrisma(async (prisma) => {
    return await prisma.collection.findMany({
      where: { userId },
      include: {
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });
  });
}

export async function getPublicCollections(limit = 50) {
  return await withPrisma(async (prisma) => {
    return await prisma.collection.findMany({
      where: { isPublic: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        items: {
          take: 3,
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  });
}

export async function searchCollections(query: string, limit = 20) {
  return await withPrisma(async (prisma) => {
    return await prisma.collection.findMany({
      where: {
        isPublic: true,
        OR: [
          {
            name: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            description: {
              contains: query,
              mode: "insensitive",
            },
          },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        items: {
          take: 3,
        },
      },
      take: limit,
    });
  });
}

export async function getCollectionArtworkCount(collectionId: string) {
  return await withPrisma(async (prisma) => {
    return await prisma.collectionItem.count({
      where: { collectionId },
    });
  });
}

export async function getCollectionWithArtworkCount(collectionId: string) {
  const [collection, count] = await Promise.all([
    getCollection(collectionId),
    getCollectionArtworkCount(collectionId),
  ]);

  return {
    ...collection,
    artworkCount: count,
  };
}
