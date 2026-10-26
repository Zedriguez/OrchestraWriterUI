import { expect, open, test } from "./helpers";

test.describe("accounts", () => {
  test("a signed-out visitor to the library is sent to sign-in with a next link back", async ({ page }) => {
    await open(page, "/library");

    await expect(page).toHaveURL((url) => url.pathname === "/sign-in" && url.searchParams.get("next") === "/library");
    await expect(page.getByRole("heading", { name: "Sign in", level: 1 })).toBeVisible();
  });

  test("signing up lands on an empty library", async ({ page, credentials }) => {
    await open(page, "/sign-up");
    await page.getByLabel("Name").fill(credentials.name);
    await page.getByLabel("Email").fill(credentials.email);
    await page.getByLabel("Password", { exact: true }).fill(credentials.password);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/library$/);
    await expect(page.getByRole("heading", { name: "Library", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Start with a score" })).toBeVisible();
    await expect(page.getByText("0 scores")).toBeVisible();
  });

  test("after signing out, signing in from a protected link returns to that page", async ({ page, account }) => {
    await open(page, "/library");
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);

    // the session is really gone: a protected page bounces with next
    await open(page, "/programs");
    await expect(page).toHaveURL((url) => url.pathname === "/sign-in" && url.searchParams.get("next") === "/programs");

    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    await expect(page).toHaveURL(/\/programs$/);
    await expect(page.getByRole("heading", { name: "Programs", level: 1 })).toBeVisible();
  });

  test("a wrong password shows an error and stays on sign-in", async ({ page, context, account }) => {
    await context.clearCookies();
    await open(page, "/sign-in");
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(`${account.password}-wrong`);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    // Next's route announcer is also an alert; pick ours by its text
    await expect(page.getByRole("alert").filter({ hasText: "That email and password don't match." })).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
  });
});
