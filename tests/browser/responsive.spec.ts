import { expect, test } from "@playwright/test";

test("mobile details fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Select P01" }).click();
  const sheet = page.getByRole("dialog", { name: "P01" });
  await expect(sheet).toBeVisible();
  const box = await sheet.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeLessThanOrEqual(2);
  expect(box!.x).toBeGreaterThanOrEqual(-2);
  expect(box!.width).toBeGreaterThanOrEqual(380);
  await page.screenshot({
    path: "test-results/building-mobile-sheet.png",
    fullPage: false,
  });
});
