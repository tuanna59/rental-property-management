import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../src/lib/prisma";
import {
  archivePerson,
  createPerson,
  updatePerson,
} from "../src/modules/people/server/mutations";
import { getPersonById } from "../src/modules/people/server/queries";

const fixturePrefix = "Phase 2A Fictional";

async function removeFixtures() {
  await prisma.person.deleteMany({
    where: { fullName: { startsWith: fixturePrefix } },
  });
}

beforeAll(removeFixtures);
afterAll(async () => {
  await removeFixtures();
  await prisma.$disconnect();
});

describe.sequential("persisted person operations", () => {
  let requiredPersonId: string;
  let protectedPersonId: string;

  it("creates a person with only the required name", async () => {
    const created = await createPerson({
      fullName: `  ${fixturePrefix} Required  `,
    });
    requiredPersonId = created.id;

    expect(
      await prisma.person.findUniqueOrThrow({ where: { id: created.id } }),
    ).toMatchObject({
      fullName: `${fixturePrefix} Required`,
      phone: null,
      citizenIdEncrypted: null,
      archivedAt: null,
    });
  });

  it("creates optional data without persisting plaintext citizen ID", async () => {
    const citizenId = "012345678901";
    const created = await createPerson({
      fullName: `${fixturePrefix} Protected`,
      phone: "090 123 4567",
      dateOfBirth: new Date("1990-02-03T00:00:00.000Z"),
      citizenId,
      notes: "Fictional integration fixture.",
    });
    protectedPersonId = created.id;

    const stored = await prisma.person.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(stored).toMatchObject({
      phone: "090 123 4567",
      phoneNormalized: "+84901234567",
      citizenIdLast4: "8901",
    });
    expect(stored.citizenIdEncrypted).not.toBe(citizenId);
    expect(stored.citizenIdLookupHash).not.toBe(citizenId);
    expect(JSON.stringify(stored)).not.toContain(citizenId);
  });

  it("updates optional fields while preserving protected identity data", async () => {
    const before = await prisma.person.findUniqueOrThrow({
      where: { id: protectedPersonId },
    });
    await updatePerson({
      personId: protectedPersonId,
      fullName: `${fixturePrefix} Protected Updated`,
      phone: "+84 912 345 678",
    });
    const after = await prisma.person.findUniqueOrThrow({
      where: { id: protectedPersonId },
    });
    expect(after).toMatchObject({
      fullName: `${fixturePrefix} Protected Updated`,
      phoneNormalized: "+84912345678",
      notes: null,
    });
    expect(after.citizenIdEncrypted).toBe(before.citizenIdEncrypted);
    expect(after.citizenIdLookupHash).toBe(before.citizenIdLookupHash);
  });

  it("rejects duplicate normalized citizen IDs", async () => {
    await expect(
      createPerson({
        fullName: `${fixturePrefix} Duplicate`,
        citizenId: "012 345 678 901",
      }),
    ).rejects.toThrow("already exists");
  });

  it("archives without deleting and remains explicitly queryable", async () => {
    await archivePerson({ personId: requiredPersonId });
    expect(await getPersonById(requiredPersonId)).toBeNull();
    const archived = await getPersonById(requiredPersonId, {
      includeArchived: true,
    });
    expect(archived?.archivedAt).toBeInstanceOf(Date);
    expect(
      await prisma.person.findUnique({ where: { id: requiredPersonId } }),
    ).not.toBeNull();
  });
});
