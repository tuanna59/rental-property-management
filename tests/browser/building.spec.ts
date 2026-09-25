import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { auditDatabaseUrl } from "../audit-environment";

async function clearAuditFloor() {
  const db = new Client({ connectionString: auditDatabaseUrl() });
  await db.connect();
  try {
    await db.query("BEGIN");
    await db.query(
      'DELETE FROM "Space" WHERE "floorId" IN (SELECT f.id FROM "Floor" f JOIN "Property" p ON p.id=f."propertyId" WHERE p.name=$1 AND f.name=$2)',
      ["My Rental Property", "Floor 4"],
    );
    await db.query(
      'DELETE FROM "Floor" WHERE "propertyId" IN (SELECT id FROM "Property" WHERE name=$1) AND name=$2',
      ["My Rental Property", "Floor 4"],
    );
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    await db.end();
  }
}

test.beforeEach(clearAuditFloor);
test.afterEach(clearAuditFloor);

test("fresh seed, dynamic floor and spaces, order, refresh, and mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const building = page.getByRole("region", {
    name: "Interactive building cutaway",
  });
  await expect(
    building.getByRole("button", { name: "Select P01" }),
  ).toBeVisible();
  await expect(
    building.getByRole("button", { name: "Select P08" }),
  ).toBeVisible();
  await expect(building.locator(".space-visual")).toHaveCount(11);

  const sidebar = page.getByRole("complementary", {
    name: "Property navigation",
  });
  expect((await sidebar.boundingBox())!.width).toBeGreaterThan(200);
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(sidebar).toHaveCSS("width", "68px");
  expect((await sidebar.boundingBox())!.width).toBeLessThanOrEqual(72);
  await page.reload();
  await expect(sidebar).toHaveCSS("width", "68px");
  expect((await sidebar.boundingBox())!.width).toBeLessThanOrEqual(72);
  await page.getByRole("button", { name: "Expand sidebar" }).focus();
  await page.keyboard.press("Enter");
  await expect(sidebar).toHaveCSS("width", "232px");

  await page.locator(".add-menu summary").click();
  await page
    .locator(".add-menu-content")
    .getByRole("button", { name: "Floor", exact: true })
    .click();
  await page.getByRole("dialog").getByLabel("Name").fill("Floor 4");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add floor" })
    .click();
  const floor = page
    .locator("section[data-floor-id]")
    .filter({ has: page.getByRole("heading", { name: "Floor 4" }) });
  await expect(floor).toBeVisible();
  await expect(floor.getByText("No spaces")).toBeVisible();
  const referenceFloor = page
    .locator("section[data-floor-id]")
    .filter({ has: page.getByRole("heading", { name: "Floor 3" }) });
  expect((await floor.boundingBox())!.width).toBeCloseTo(
    (await referenceFloor.boundingBox())!.width,
    0,
  );

  await page.getByRole("button", { name: "Edit building" }).click();
  for (const name of ["P09", "P10"]) {
    await floor.getByRole("button", { name: "Add space" }).click();
    await page.getByRole("dialog").getByLabel("Name or identifier").fill(name);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add space" })
      .click();
    await expect(
      floor.getByRole("button", { name: `Select ${name}` }),
    ).toBeVisible();
  }
  const fourSpaceRoom = await building
    .getByRole("button", { name: "Select P05" })
    .boundingBox();
  const twoSpaceRoom = await building
    .getByRole("button", { name: "Select P09" })
    .boundingBox();
  expect(fourSpaceRoom && twoSpaceRoom).toBeTruthy();
  expect(twoSpaceRoom!.width).toBeGreaterThan(fourSpaceRoom!.width * 1.8);

  await floor.getByRole("button", { name: "Add space" }).click();
  await page.getByRole("dialog").getByLabel("Name or identifier").fill("P11");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add space" })
    .click();
  await expect(floor.getByRole("button", { name: "Select P11" })).toBeVisible();
  await page.reload();
  await expect(floor.getByRole("button", { name: "Select P09" })).toBeVisible();
  await expect(floor.getByRole("button", { name: "Select P10" })).toBeVisible();
  await expect(floor.getByRole("button", { name: "Select P11" })).toBeVisible();
  await expect(floor.locator(".space-visual").first()).toContainText("P09");
  await floor.getByRole("button", { name: "Select P10" }).click();
  await expect(
    page.getByRole("complementary", { name: "Space details" }),
  ).toContainText("P10");
  await page.getByRole("button", { name: "Move space left" }).click();
  await expect(floor.locator(".space-visual").first()).toContainText("P10");
  await page.reload();
  await expect(floor.locator(".space-visual").first()).toContainText("P10");

  for (const width of [1280, 1440, 1920, 2560]) {
    await page.setViewportSize({ width, height: 1000 });
    const shell = await page.locator(".building-shell").boundingBox();
    const canvas = await page.locator(".building-canvas").boundingBox();
    const room = await building
      .getByRole("button", { name: "Select P05" })
      .boundingBox();
    const addedRoom = await building
      .getByRole("button", { name: "Select P09" })
      .boundingBox();
    const panel = await page
      .getByRole("complementary", { name: "Space details" })
      .boundingBox();
    expect(shell && canvas && room && addedRoom && panel).toBeTruthy();
    expect(shell!.width).toBeLessThanOrEqual(1020);
    expect(room!.width).toBeLessThan(260);
    expect(addedRoom!.width).toBeGreaterThan(room!.width * 1.2);
    expect(addedRoom!.width).toBeLessThan(room!.width * 1.5);
    expect((await floor.boundingBox())!.width).toBeCloseTo(
      (await referenceFloor.boundingBox())!.width,
      0,
    );
    expect(shell!.x + shell!.width).toBeLessThan(panel!.x);
    expect(canvas!.width).toBeGreaterThan(shell!.width);
    await page.screenshot({
      path: `test-results/building-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Select P07" }).click();
  await expect(page.getByRole("button", { name: "Select P07" })).toHaveClass(
    /is-selected/,
  );
  await expect(
    page.getByRole("complementary", { name: "Space details" }),
  ).toContainText("P07");
  await page.screenshot({
    path: "test-results/building-selected.png",
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(floor.locator(".space-visual").first()).toContainText("P10");
  await page.getByRole("button", { name: "Select P09" }).click();
  await expect(page.getByRole("dialog", { name: "P09" })).toBeVisible();
  await page.screenshot({
    path: "test-results/building-mobile.png",
    fullPage: true,
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await page
    .getByRole("dialog", { name: "P09" })
    .getByRole("button", { name: "Close" })
    .click();
  await expect(page.getByRole("dialog", { name: "P09" })).toBeHidden();
});
