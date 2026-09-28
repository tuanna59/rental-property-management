import { prisma } from "@/lib/prisma";

import type { PersonRecord } from "../domain/types";
import { projectRentalState } from "../domain/rental-state";
import { citizenIdLookupHash, decryptCitizenId } from "./citizen-id";

const personSelect = {
  id: true,
  fullName: true,
  phone: true,
  phoneNormalized: true,
  dateOfBirth: true,
  citizenIdEncrypted: true,
  citizenIdLast4: true,
  avatarStorageKey: true,
  citizenIdFrontKey: true,
  citizenIdBackKey: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
} as const;

function toPersonRecord(person: {
  id: string;
  fullName: string;
  phone: string | null;
  phoneNormalized: string | null;
  dateOfBirth: Date | null;
  citizenIdEncrypted: string | null;
  citizenIdLast4: string | null;
  avatarStorageKey: string | null;
  citizenIdFrontKey: string | null;
  citizenIdBackKey: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}): PersonRecord {
  const {
    citizenIdEncrypted,
    avatarStorageKey,
    citizenIdFrontKey,
    citizenIdBackKey,
    ...safePerson
  } = person;
  return {
    ...safePerson,
    hasCitizenId: citizenIdEncrypted !== null,
    hasAvatar: avatarStorageKey !== null,
    hasCitizenIdFront: citizenIdFrontKey !== null,
    hasCitizenIdBack: citizenIdBackKey !== null,
  };
}

function currentBusinessDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export async function getPeopleDirectory(search = "") {
  const date = currentBusinessDate();
  const people = await prisma.person.findMany({
    where: search
      ? {
          OR: [
            { fullName: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: [{ archivedAt: "asc" }, { fullName: "asc" }],
    select: {
      ...personSelect,
      tenancyOccupancies: {
        orderBy: { startDate: "desc" },
        select: {
          id: true,
          role: true,
          startDate: true,
          endDate: true,
          tenancy: {
            select: {
              id: true,
              moveInDate: true,
              moveOutDate: true,
              monthlyRentVnd: true,
              rentRates: { orderBy: { effectiveFrom: "desc" } },
              responsibleHistory: {
                orderBy: { effectiveFrom: "asc" },
                select: {
                  id: true,
                  effectiveFrom: true,
                  reason: true,
                  occupant: {
                    select: {
                      id: true,
                      person: { select: { id: true, fullName: true } },
                    },
                  },
                },
              },
              occupants: {
                orderBy: { startDate: "asc" },
                select: {
                  id: true,
                  startDate: true,
                  endDate: true,
                  person: { select: { id: true, fullName: true } },
                },
              },
              invoices: {
                orderBy: [{ billingPeriod: "desc" }, { invoiceDate: "desc" }],
                select: {
                  id: true,
                  billingPeriod: true,
                  invoiceDate: true,
                  type: true,
                  status: true,
                  roomNameSnapshot: true,
                  lines: { select: { finalAmount: true } },
                  adjustments: { select: { amount: true } },
                  payments: {
                    orderBy: { paymentDate: "desc" },
                    select: {
                      id: true,
                      paymentDate: true,
                      method: true,
                      amount: true,
                      isDepositApplication: true,
                    },
                  },
                },
              },
              space: {
                select: {
                  id: true,
                  name: true,
                  floor: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  return people.map((person) => {
    const { tenancyOccupancies, ...personFields } = person;
    const safe = toPersonRecord(personFields);
    const history = tenancyOccupancies.map((membership) => {
      const rates = membership.tenancy.rentRates.map((rate) => ({
        id: rate.id,
        effectiveFrom: rate.effectiveFrom,
        monthlyRentVnd: rate.monthlyRentVnd.toString(),
        reason: rate.reason,
      }));
      const effectiveRate =
        rates.find((rate) => rate.effectiveFrom <= date) ??
        rates.at(-1) ??
        null;
      const scheduledRate =
        [...rates].reverse().find((rate) => rate.effectiveFrom > date) ?? null;
      const responsibility = membership.tenancy.responsibleHistory;
      const currentAssignment =
        [...responsibility]
          .reverse()
          .find((assignment) => assignment.effectiveFrom <= date) ?? null;
      const resolvedRole =
        currentAssignment?.occupant.id === membership.id
          ? "RESPONSIBLE"
          : "ADDITIONAL";
      return {
        membershipId: membership.id,
        tenancyId: membership.tenancy.id,
        role: resolvedRole as "RESPONSIBLE" | "ADDITIONAL",
        startDate: membership.startDate,
        endDate: membership.endDate,
        moveInDate: membership.tenancy.moveInDate,
        moveOutDate: membership.tenancy.moveOutDate,
        spaceId: membership.tenancy.space.id,
        spaceName: membership.tenancy.space.name,
        floorName: membership.tenancy.space.floor.name,
        currentRent: effectiveRate ?? {
          id: "legacy",
          effectiveFrom: membership.tenancy.moveInDate,
          monthlyRentVnd: membership.tenancy.monthlyRentVnd.toString(),
          reason: "Initial rent",
        },
        scheduledRent: scheduledRate,
        rentHistory: rates,
        occupants: membership.tenancy.occupants.map((occupant) => ({
          ...occupant,
          personId: occupant.person.id,
          personName: occupant.person.fullName,
        })),
        responsibilityHistory: responsibility.map((assignment, index) => ({
          id: assignment.id,
          effectiveFrom: assignment.effectiveFrom,
          reason: assignment.reason,
          occupantId: assignment.occupant.id,
          personId: assignment.occupant.person.id,
          personName: assignment.occupant.person.fullName,
          previousPersonName:
            index > 0
              ? responsibility[index - 1].occupant.person.fullName
              : null,
        })),
        invoices: membership.tenancy.invoices.map((invoice) => {
          const total =
            invoice.lines.reduce(
              (sum, item) => sum + Number(item.finalAmount),
              0,
            ) +
            invoice.adjustments.reduce(
              (sum, item) => sum + Number(item.amount),
              0,
            );
          const paid = invoice.payments.reduce(
            (sum, payment) => sum + Number(payment.amount),
            0,
          );
          const balance = Math.max(total - paid, 0);
          return {
            id: invoice.id,
            billingPeriod: invoice.billingPeriod,
            invoiceDate: invoice.invoiceDate,
            type: invoice.type,
            roomName: invoice.roomNameSnapshot,
            amount: String(total),
            balance: String(balance),
            displayStatus:
              balance === 0 && total > 0
                ? "Paid"
                : paid > 0
                  ? "Partial"
                  : invoice.status === "FINALIZED"
                    ? "Unpaid"
                    : "Draft",
            payments: invoice.payments.map((payment) => ({
              id: payment.id,
              paymentDate: payment.paymentDate,
              method: payment.method,
              amount: payment.amount.toString(),
              isDepositApplication: payment.isDepositApplication,
            })),
          };
        }),
      };
    });
    const projection = projectRentalState(history, date);
    const match = (period: (typeof history)[number]) =>
      history.find((item) => item.membershipId === period.membershipId) ?? null;
    return {
      ...safe,
      rentalState: projection.state,
      currentTenancy: projection.current ? match(projection.current) : null,
      upcomingTenancy: projection.upcoming ? match(projection.upcoming) : null,
      lastTenancy: history[0] ?? null,
      rentalHistory: history,
    };
  });
}

export async function getPersonById(
  personId: string,
  options: { includeArchived?: boolean } = {},
) {
  const person = await prisma.person.findFirst({
    where: {
      id: personId,
      ...(options.includeArchived ? {} : { archivedAt: null }),
    },
    select: personSelect,
  });
  return person ? toPersonRecord(person) : null;
}

export async function findPersonByCitizenId(
  citizenId: string,
  options: { includeArchived?: boolean } = {},
) {
  const person = await prisma.person.findFirst({
    where: {
      citizenIdLookupHash: citizenIdLookupHash(citizenId),
      ...(options.includeArchived ? {} : { archivedAt: null }),
    },
    select: personSelect,
  });
  return person ? toPersonRecord(person) : null;
}

export async function revealPersonCitizenId(personId: string) {
  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: { citizenIdEncrypted: true },
  });
  if (!person?.citizenIdEncrypted) return null;
  return decryptCitizenId(person.citizenIdEncrypted);
}
