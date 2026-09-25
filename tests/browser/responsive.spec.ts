import { expect, test } from "@playwright/test";

test("mobile navigation and details fit supported viewports", async ({
  page,
}) => {
  for (const width of [375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await expect(
      page.getByRole("complementary", { name: "Property navigation" }),
    ).toBeHidden();
    await page.getByRole("button", { name: "Open navigation" }).click();
    const drawer = page.getByRole("complementary", {
      name: "Property navigation",
    });
    await expect(drawer).toBeVisible();
    const drawerBox = await drawer.boundingBox();
    expect(drawerBox!.x).toBeGreaterThanOrEqual(0);
    expect(drawerBox!.x + drawerBox!.width).toBeLessThanOrEqual(width);
    await drawer.getByRole("button", { name: "Close navigation" }).click();

    await page.getByRole("button", { name: "Select P01" }).click();
    const sheet = page.getByRole("dialog", { name: "P01" });
    await expect(sheet).toBeVisible();
    const box = await sheet.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(-2);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 2);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: `test-results/building-mobile-${width}.png`,
      fullPage: false,
    });
    await sheet.getByRole("button", { name: "Close" }).click();
  }
});
