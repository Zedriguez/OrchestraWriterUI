import { DEMO, SCORE_FILE, expect, open, previewBar, stepUrl, test } from "./helpers";

test("a score without a recording skips Sync and plays back generated audio", async ({ page, account }) => {
  void account;

  await open(page, "/projects/new");
  await expect(page).toHaveURL(stepUrl("import"));
  await page.getByTestId("score-input").setInputFiles(SCORE_FILE);
  await expect(page.getByRole("region", { name: "Score" }).getByText("Parsed", { exact: true })).toBeVisible({ timeout: 30_000 });

  await test.step("Continue goes straight to Customize", async () => {
    await expect(page.getByRole("button", { name: "Continue to Sync" })).toHaveCount(0);
    await page.getByRole("button", { name: "Continue to Customize" }).click();
    await expect(page).toHaveURL(stepUrl("customize"));
    await expect(page.getByRole("heading", { name: "Customize the display", level: 1 })).toBeVisible();
  });

  await test.step("the Sync step is struck through and not a link", async () => {
    const steps = page.getByRole("navigation", { name: "Project steps" });
    const sync = steps.getByText("Sync", { exact: true });
    await expect(sync).toHaveAttribute("aria-disabled", "true");
    await expect(sync).toHaveCSS("text-decoration-line", "line-through");
    await expect(steps.getByRole("link", { name: "Sync" })).toHaveCount(0);
    await expect(steps.getByRole("link", { name: "Customize" })).toHaveAttribute("aria-current", "step");
  });

  await test.step("Preview says the audio is generated and offers no sync editing", async () => {
    await page.getByRole("button", { name: "Continue to Preview" }).click();
    await expect(page).toHaveURL(stepUrl("preview"));
    await expect(page.getByText("Generated from score", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit display" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit sync" })).toHaveCount(0);
    await expect(page.getByText(new RegExp(`^bar \\d+ of ${DEMO.measures}$`))).toBeVisible();
  });

  await test.step("Play advances the bar counter (score synth)", async () => {
    const play = page.getByRole("button", { name: "Play", exact: true });
    await expect(play).toBeEnabled();
    await expect(play).not.toHaveAttribute("aria-busy", "true", { timeout: 30_000 });
    const before = await previewBar(page);
    await play.click();
    await expect.poll(() => previewBar(page), { timeout: 15_000, message: "the bar counter advances while playing" }).toBeGreaterThan(before);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
  });
});
