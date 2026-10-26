import type { Page } from "@playwright/test";
import { buildProject, expect, open, reload, test } from "./helpers";

/** The library card (grid view) whose title is `title`. */
function card(page: Page, title: string) {
  return page
    .getByRole("list", { name: "Scores" })
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
}

test.describe("library and programs", () => {
  test("the library lists each project with its status", async ({ page, account }) => {
    void account;
    await buildProject(page.request, { title: "Nocturne" });
    await buildProject(page.request, { title: "Serenade", recording: true });

    await open(page, "/library");
    await expect(page.getByText("2 scores", { exact: true })).toBeVisible();
    await expect(card(page, "Nocturne").getByText("Ready", { exact: true })).toBeVisible();
    await expect(card(page, "Serenade").getByText("Needs sync", { exact: true })).toBeVisible();
    await expect(card(page, "Serenade").getByRole("img", { name: "Has a recording" })).toBeVisible();
    await expect(card(page, "Nocturne").getByRole("img", { name: "Has a recording" })).toHaveCount(0);
  });

  test("a program collects pieces, reorders them, keeps notes and can be deleted", async ({ page, account }) => {
    void account;
    await buildProject(page.request, { title: "Allegro" });
    await buildProject(page.request, { title: "Largo" });
    const order = page.getByRole("region", { name: "Running order" }).getByRole("listitem");

    await test.step("create the program", async () => {
      await open(page, "/programs");
      await page.getByRole("button", { name: "New program" }).first().click();
      const dialog = page.getByRole("dialog", { name: "New program" });
      await dialog.getByLabel("Name").fill("Spring Gala");
      await dialog.getByRole("button", { name: "Create program" }).click();
      await expect(page).toHaveURL(/\/programs\/[^/]+$/);
      await expect(page.getByRole("heading", { name: "Spring Gala", level: 1 })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Nothing programmed yet" })).toBeVisible();
    });

    const addPiece = async (title: string) => {
      await page.getByRole("button", { name: "Add pieces" }).first().click();
      const dialog = page.getByRole("dialog", { name: "Add pieces" });
      await dialog.getByRole("checkbox", { name: title }).check();
      await dialog.getByRole("button", { name: "Add piece", exact: true }).click();
      await expect(dialog).toBeHidden();
    };

    await test.step("add two pieces, one at a time", async () => {
      await addPiece("Allegro");
      await expect(order).toHaveCount(1);
      await addPiece("Largo");
      await expect(order).toHaveCount(2);
      await expect(order.nth(0)).toContainText("Allegro");
      await expect(order.nth(1)).toContainText("Largo");
    });

    await test.step("move the second piece up; the order is saved", async () => {
      const saved = page.waitForResponse((r) => r.request().method() === "PATCH" && /\/api\/programs\/[^/]+$/.test(r.url()) && r.ok());
      await page.getByRole("button", { name: "Move “Largo” up" }).click();
      await expect(order.nth(0)).toContainText("Largo");
      await expect(order.nth(1)).toContainText("Allegro");
      await saved;
      await reload(page);
      await expect(order.nth(0)).toContainText("Largo");
      await expect(order.nth(1)).toContainText("Allegro");
    });

    await test.step("notes save when the box loses focus", async () => {
      const notes = page.getByRole("textbox", { name: "Notes" });
      await notes.fill("Lobby screen before the second half.");
      await expect(page.getByText("Saves when you leave the box.")).toBeVisible();
      await notes.blur();
      await expect(page.getByText("Saved", { exact: true })).toBeVisible();
      await reload(page);
      await expect(page.getByRole("textbox", { name: "Notes" })).toHaveValue("Lobby screen before the second half.");
    });

    await test.step("delete the program; the pieces stay in the library", async () => {
      await page.getByRole("button", { name: "More program actions" }).click();
      await page.getByRole("menuitem", { name: "Delete program…" }).click();
      const dialog = page.getByRole("dialog", { name: "Delete “Spring Gala”?" });
      await dialog.getByRole("button", { name: "Delete program" }).click();
      await expect(page).toHaveURL(/\/programs$/);
      await expect(page.getByRole("heading", { name: "Plan a concert" })).toBeVisible();
      await expect(page.getByText("0 programs", { exact: true })).toBeVisible();

      await open(page, "/library");
      await expect(card(page, "Allegro")).toHaveCount(1);
      await expect(card(page, "Largo")).toHaveCount(1);
    });
  });

  test("deleting a project from its card menu removes it", async ({ page, account }) => {
    void account;
    const doomed = await buildProject(page.request, { title: "Scherzo" });
    await buildProject(page.request, { title: "Finale" });

    await open(page, "/library");
    await expect(card(page, "Scherzo")).toHaveCount(1);
    await page.getByRole("button", { name: "Actions for Scherzo" }).click();
    await page.getByRole("menuitem", { name: "Delete…" }).click();
    const dialog = page.getByRole("dialog", { name: "Delete “Scherzo”?" });
    await dialog.getByRole("button", { name: "Delete project" }).click();

    await expect(dialog).toBeHidden();
    await expect(card(page, "Scherzo")).toHaveCount(0);
    await expect(card(page, "Finale")).toHaveCount(1);
    await expect(page.getByText("1 score", { exact: true })).toBeVisible();

    // gone on the server too, not just from the list
    await reload(page);
    await expect(card(page, "Finale")).toHaveCount(1);
    await expect(card(page, "Scherzo")).toHaveCount(0);
    const res = await page.request.get(`/api/projects/${doomed.id}`);
    expect(res.status()).toBe(404);
  });
});
