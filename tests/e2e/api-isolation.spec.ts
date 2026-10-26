import { ORIGIN, api, deleteAccount, expect, newCredentials, open, prepareContext, signUpViaApi, test } from "./helpers";

test.describe("another user's project", () => {
  test("is a 404 to a second signed-in user, through the API and the workflow pages", async ({ page, account, browser, clientIp }) => {
    void account;
    const mine = await api(page.request).createProject("Private rehearsal");

    // user B: a separate browser context, so a separate cookie jar
    const other = await browser.newContext({ baseURL: ORIGIN });
    await prepareContext(other, clientIp);
    const intruder = newCredentials("intruder");
    try {
      await signUpViaApi(other.request, intruder, clientIp);
      const theirs = await other.newPage();
      await open(theirs, "/library");
      await expect(theirs.getByRole("heading", { name: "Library", level: 1 })).toBeVisible();

      // requests from B's page carry B's session cookie and the page's Origin
      const statuses = await theirs.evaluate(async (id) => {
        const json = { "content-type": "application/json" };
        const call = async (method: string, path: string, body?: unknown) =>
          (await fetch(`/api/projects/${id}${path}`, { method, headers: json, body: body === undefined ? undefined : JSON.stringify(body) })).status;
        return {
          get: await call("GET", ""),
          patch: await call("PATCH", "", { title: "Mine now" }),
          urls: await call("GET", "/urls"),
          exports: await call("GET", "/exports"),
          // a valid body, so only ownership can refuse it
          display: await call("PUT", "/display", {
            visibleParts: [],
            positions: {},
            colors: {},
            sectionColors: {},
            sections: {},
            showLabels: true,
            labelMode: "parts",
            reducedMotion: false,
            glowScale: 1,
          }),
          remove: await call("DELETE", ""),
          list: (await (await fetch("/api/projects")).json()).projects.length as number,
        };
      }, mine.id);
      expect(statuses).toEqual({ get: 404, patch: 404, urls: 404, exports: 404, display: 404, remove: 404, list: 0 });

      // the workflow pages show not-found rather than A's project
      await open(theirs, `/projects/${mine.id}/customize`);
      await expect(theirs.getByRole("heading", { name: "This page is resting" })).toBeVisible({ timeout: 30_000 });
      await expect(theirs.getByText("Private rehearsal")).toHaveCount(0);
    } finally {
      await deleteAccount(other.request, intruder, clientIp);
      await other.close();
    }

    // A's project is untouched
    const after = await api(page.request).getProject(mine.id);
    expect(after.title).toBe("Private rehearsal");
  });

  test("is refused to a signed-out caller with 401", async ({ page, account, playwright }) => {
    void account;
    const mine = await api(page.request).createProject("Private rehearsal");
    const anonymous = await playwright.request.newContext({ baseURL: ORIGIN });
    try {
      expect((await anonymous.get(`/api/projects/${mine.id}`)).status()).toBe(401);
      expect((await anonymous.get("/api/projects")).status()).toBe(401);
      expect((await anonymous.delete(`/api/projects/${mine.id}`, { headers: { origin: ORIGIN } })).status()).toBe(401);
    } finally {
      await anonymous.dispose();
    }
    expect((await api(page.request).getProject(mine.id)).title).toBe("Private rehearsal");
  });
});
