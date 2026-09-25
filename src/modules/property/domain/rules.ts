export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export type OrderedEntity = {
  id: string;
  sortOrder: number;
};

export function nextSortOrder(items: OrderedEntity[]) {
  return items.length === 0
    ? 1
    : Math.max(...items.map((item) => item.sortOrder)) + 1;
}

export function moveOrderedId(
  orderedIds: string[],
  movingId: string,
  direction: "up" | "down",
) {
  const currentIndex = orderedIds.indexOf(movingId);

  if (currentIndex === -1) {
    throw new DomainError("The item being reordered was not found.");
  }

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (targetIndex < 0 || targetIndex >= orderedIds.length) {
    return orderedIds;
  }

  const reordered = [...orderedIds];
  const [moving] = reordered.splice(currentIndex, 1);
  reordered.splice(targetIndex, 0, moving);
  return reordered;
}

export function assertCanArchiveFloor(activeSpaceCount: number) {
  if (activeSpaceCount > 0) {
    throw new DomainError(
      "Archive or move spaces before archiving this floor.",
    );
  }
}

export function assertCanDeleteFloor(spaceCount: number) {
  if (spaceCount > 0) {
    throw new DomainError("Delete is only allowed for floors with no spaces.");
  }
}

export function assertSpaceBelongsToFloor(
  spaceFloorId: string,
  expectedFloorId: string,
) {
  if (spaceFloorId !== expectedFloorId) {
    throw new DomainError("The selected space does not belong to this floor.");
  }
}

export function assertActiveRecord<T>(
  record: T | null | undefined,
  message = "The requested record was not found.",
): asserts record is T {
  if (!record) {
    throw new DomainError(message);
  }
}
