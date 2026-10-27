import { expect, test } from '@playwright/test';

test('discreet gateway works on desktop and mobile and keeps community pages private', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'nb-NO', baseURL: 'http://localhost:3100', viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('VOGN.');
  await expect(page.getByText('Ditt sted. Dine folk.')).toBeVisible();
  await expect(page.locator('main a')).toHaveCount(2);
  await expect(page.locator('main').getByRole('link', { name: 'Logg inn' })).toHaveAttribute('href', '/sign-in');
  await expect(page.locator('main').getByRole('link', { name: 'Opprett konto' })).toHaveAttribute('href', '/sign-up');
  await expect(page.locator('main input')).toHaveCount(0);
  expect(await page.locator('main a').first().evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(242, 243, 245)');
  await page.screenshot({ path: 'test-results/gateway-desktop.png', fullPage: true });

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.locator('main').getByRole('link', { name: 'Logg inn' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.screenshot({ path: 'test-results/gateway-mobile.png', fullPage: true });
  await page.locator('main').getByRole('link', { name: 'Logg inn' }).click();
  await expect(page.getByRole('heading', { name: 'Velkommen tilbake' })).toBeVisible();

  for (const path of ['/discover', '/events', '/u/example', '/v/example', '/c/example', '/invite/example', '/studio/playground']) {
    const response = await context.request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(307);
    expect(new URL(response.headers().location!, 'http://localhost:3100').pathname, path).toBe('/sign-in');
  }
  await context.close();
});
