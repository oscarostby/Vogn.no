import { expect, test } from '@playwright/test';

test('plate lookup fills editable car fields and saves personal changes', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ baseURL: 'http://localhost:3100', locale: 'en-US' });
  const page = await context.newPage();
  await page.goto('/sign-up');
  await page.getByLabel('Login name', { exact: true }).fill('plate_rider');
  await page.getByLabel('Password', { exact: true }).fill('plate-personal-password-12345');
  await page.getByLabel('Confirm password', { exact: true }).fill('plate-personal-password-12345');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.waitForURL('**/onboarding');
  await expect(page.locator('input[name="username"]')).toHaveValue('plate_rider');
  await page.locator('input[name="displayName"]').fill('Plate Rider');
  await page.getByRole('checkbox').check();
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/home');
  await page.goto('/garage/new');
  await page.route('**/api/v1/vehicles/lookup', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ countryCode: 'NO', registrationNumber: 'AB 12345' });
    await route.fulfill({ json: { data: {
      provider: 'Statens vegvesen', countryCode: 'NO', fetchedAt: new Date().toISOString(),
      make: 'SUBARU', model: 'IMPREZA', color: 'Silver', engine: 'EJ20', firstRegistration: '2008-11-24',
      modelYear: null, fuel: 'petrol', powerKw: 110, displacementCc: 1994, gearbox: 'automatic', drivetrain: 'awd', weightKg: 1435,
    } } });
  });
  await page.getByLabel('Norwegian registration number', { exact: true }).fill('AB 12345');
  await page.getByRole('button', { name: 'Find vehicle' }).click();
  await expect(page.locator('input[name="make"]')).toHaveValue('SUBARU');
  await expect(page.locator('input[name="model"]')).toHaveValue('IMPREZA');
  await expect(page.locator('input[name="year"]')).toHaveValue('2008');
  await expect(page.locator('input[name="specs.originalHp"]')).toHaveValue('150');
  await page.screenshot({ path: testInfo.outputPath('plate-autofill.jpg'), type: 'jpeg', fullPage: false });
  await page.locator('input[name="model"]').fill('Impreza WRX');
  await page.locator('input[name="nickname"]').fill('My imported car');
  await page.getByRole('button', { name: 'Add vehicle', exact: true }).click();
  await page.waitForURL('**/v/*');
  const vehicleId = new URL(page.url()).pathname.split('/').at(-1);
  const vehicle = (await (await context.request.get(`/api/v1/vehicles/${vehicleId}`)).json()).data;
  expect(vehicle.model).toBe('Impreza WRX');
  expect(vehicle.nickname).toBe('My imported car');
  expect(vehicle.specs.originalHp).toBe(150);
  expect(vehicle.viewer.hasPrivateIdentifiers).toBe(true);
  expect(vehicle.officialData).toBeNull();
  await page.goto(`/garage/${vehicleId}/edit`);
  await expect(page.locator('input[name="model"]')).toHaveValue('Impreza WRX');
  await context.close();
});
