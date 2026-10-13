import { expect, test, type Browser, type BrowserContext } from '@playwright/test';
import sharp from 'sharp';

async function login(browser: Browser, name: string) {
  const context = await browser.newContext({ locale: 'en-US', baseURL: 'http://localhost:3100' });
  const page = await context.newPage();
  await page.goto('/sign-in');
  await page.getByLabel('Test login name').fill(name);
  await page.getByLabel('Private test password').fill('e2e-private-only-password-12345');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForURL('**/onboarding');
  await page.locator('input[name="username"]').fill(name);
  await page.locator('input[name="displayName"]').fill(name === 'owner_ui' ? 'Test Owner' : 'Test Member');
  await page.getByRole('checkbox').check();
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/home');
  await expect(page.getByRole('heading').first()).toBeVisible();
  return { context, page };
}

async function write(context: BrowserContext, path: string, data: unknown, method = 'POST') {
  const result = await context.request.fetch(`/api/v1${path}`, { method, headers: { Origin: 'http://localhost:3100' }, data });
  expect(result.status(), `HTTP ${method} ${path}`).toBeLessThan(400);
  return (await result.json()).data;
}

test('private login, Mongo persistence, image privacy, two-user chat, Studio and main pages', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const anonymous = await browser.newContext({ baseURL: 'http://localhost:3100' });
  expect((await anonymous.request.get('/api/v1/discover/crews')).status()).toBe(401);
  const outsiderPage = await anonymous.newPage();
  await outsiderPage.goto('/home');
  await expect(outsiderPage).toHaveURL(/\/sign-in/);
  await anonymous.close();
  const a = await login(browser, 'owner_ui');
  const b = await login(browser, 'member_ui');
  const errors: string[] = [];
  a.page.on('pageerror', (error) => errors.push(error.message));
  b.page.on('pageerror', (error) => errors.push(error.message));
  await a.page.goto('/crews/new');
  await a.page.getByLabel('Crew name', { exact: true }).fill('Browser Test Crew');
  await a.page.getByLabel('Address', { exact: true }).fill('browser-test-crew');
  await a.page.locator('button[type="submit"]').click();
  await a.page.waitForURL('**/c/browser-test-crew');
  const crew = (await (await a.context.request.get('/api/v1/crews/browser-test-crew')).json()).data;
  await write(b.context, `/crews/id/${crew.id}/join`, {});
  const channels = (await (await a.context.request.get(`/api/v1/crews/id/${crew.id}/channels`)).json()).data;
  const general = channels.find((channel: { name: string }) => channel.name === 'general');
  expect(general?.conversationId).toBeTruthy();
  const chatPath = `/c/browser-test-crew/ch/${general.id}`;
  await a.page.goto(chatPath); await b.page.goto(chatPath);
  await a.page.getByLabel('Message', { exact: true }).fill('Durable browser message');
  await a.page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(b.page.getByText('Durable browser message', { exact: true })).toBeVisible();
  const image = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#c8ff5f' } }).png().toBuffer();
  const dropped = (fileName: string) => a.page.evaluateHandle(({ bytes, name }) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(bytes)], name, { type: 'image/png' }));
    return transfer;
  }, { bytes: [...image], name: fileName });
  const chatFiles = await dropped('dropped-chat.png');
  await a.page.getByLabel('Message', { exact: true }).dispatchEvent('dragenter', { dataTransfer: chatFiles });
  await expect(a.page.getByText('Drop images to attach', { exact: true })).toBeVisible();
  await a.page.getByLabel('Message', { exact: true }).dispatchEvent('drop', { dataTransfer: chatFiles });
  await expect(a.page.getByRole('button', { name: 'Remove attachment' })).toBeVisible();
  await expect(a.page.getByText('Drop images to attach', { exact: true })).toHaveCount(0);
  await a.page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(b.page.locator('img[src*="/api/v1/media/test-image/"]')).toBeVisible();
  await b.page.reload();
  await expect(b.page.getByText('Durable browser message', { exact: true })).toBeVisible();
  const member = (await (await b.context.request.get('/api/v1/me')).json()).data;
  const dm = await write(a.context, '/conversations', { userIds: [member.id] });
  await write(a.context, `/conversations/${dm.id}/messages`, { content: 'Private browser DM', idempotencyKey: 'c5727e14-1d40-4815-8fbe-6161f79c3b54' });
  await b.page.goto(`/messages/${dm.id}`);
  await expect(b.page.getByText('Private browser DM', { exact: true })).toBeVisible();
  const vehicle = await write(a.context, '/vehicles', { make: 'Toyota', model: 'Supra', visibility: 'private' });
  const media = await write(a.context, '/media/test-upload', { purpose: 'vehicle', mime: 'image/png', size: image.length, base64: image.toString('base64') });
  await write(a.context, `/vehicles/${vehicle.id}/gallery`, { mediaIds: [media.id] }, 'PUT');
  expect((await a.context.request.get(media.url)).status()).toBe(200);
  expect((await b.context.request.get(media.url)).status()).toBe(404);
  await a.page.goto('/settings/profile');
  const [avatarSave] = await Promise.all([
    a.page.waitForResponse((response) => response.url().endsWith('/api/v1/me') && response.request().method() === 'PATCH'),
    a.page.locator('input[type="file"]').first().setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: image }),
  ]);
  expect(avatarSave.status()).toBe(200);
  const avatarFiles = await dropped('dropped-avatar.png');
  const avatarArea = a.page.getByRole('group', { name: 'Avatar' });
  await avatarArea.dispatchEvent('dragenter', { dataTransfer: avatarFiles });
  await expect(avatarArea.getByRole('button', { name: 'Drop to upload' })).toBeVisible();
  const [avatarDrop] = await Promise.all([
    a.page.waitForResponse((response) => response.url().endsWith('/api/v1/me') && response.request().method() === 'PATCH'),
    avatarArea.dispatchEvent('drop', { dataTransfer: avatarFiles }),
  ]);
  expect(avatarDrop.status()).toBe(200);
  await expect(avatarArea.getByRole('button', { name: 'Change avatar' })).toBeVisible();
  const bigPhoto = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: '#000', noise: { type: 'gaussian', mean: 128, sigma: 20 } } }).jpeg({ quality: 92 }).toBuffer();
  expect(bigPhoto.length).toBeGreaterThan(2 * 1024 * 1024);
  const [bigAvatar] = await Promise.all([
    a.page.waitForResponse((response) => response.url().endsWith('/api/v1/me') && response.request().method() === 'PATCH'),
    a.page.locator('input[type="file"]').first().setInputFiles({ name: 'big-photo.jpg', mimeType: 'image/jpeg', buffer: bigPhoto }),
  ]);
  expect(bigAvatar.status()).toBe(200);
  await a.page.goto(`/c/browser-test-crew/studio`);
  await a.page.getByRole('combobox', { name: 'Preset', exact: true }).selectOption('tokyo-midnight');
  await a.page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(a.page.getByText('Theme published', { exact: true })).toBeVisible();
  const theme = (await (await b.context.request.get(`/api/v1/crews/id/${crew.id}/theme`)).json()).data;
  expect(theme.manifest.meta.presetId).toBe('tokyo-midnight');
  await a.page.goto('/c/browser-test-crew');
  await expect(a.page.getByText('Browser Test Crew', { exact: true }).first()).toBeVisible();
  await a.page.screenshot({ path: testInfo.outputPath('crew-desktop.png'), fullPage: true });
  for (const route of ['/home', '/garage', '/crews', '/discover', '/events', '/messages', '/notifications', '/settings', '/verification', '/admin', '/studio/playground']) {
    const response = await a.page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expect(a.page.locator('#main, main').first()).toBeVisible();
    await expect(a.page.getByText('Internal server error.', { exact: true })).toHaveCount(0);
  }
  await a.page.setViewportSize({ width: 390, height: 844 });
  await a.page.goto('/crews');
  await expect(a.page.getByRole('heading', { name: 'Your crews' })).toBeVisible();
  expect(await a.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await a.page.screenshot({ path: testInfo.outputPath('crews-mobile.png'), fullPage: true });
  expect(errors).toEqual([]);
  await a.context.close(); await b.context.close();
});
