export default async function run(page, ui) {
  const results = {};

  const skip = page.locator('#skipBoot');
  if (await skip.count()) { await skip.click().catch(() => {}); }
  await page.waitForTimeout(300);

  results.dashboardVisible = await page.evaluate(() =>
    document.querySelector('#dashboardView')?.classList.contains('active'));

  await page.locator('button[data-view="settings"]').click();
  await page.waitForTimeout(200);
  results.settingsVisible = await page.evaluate(() =>
    document.querySelector('#settingsView')?.classList.contains('active'));

  await page.locator('button[data-view="calendar"]').click();
  await page.waitForTimeout(200);
  results.calendarCells = await page.evaluate(() =>
    document.querySelectorAll('.calendar-cell').length);

  await page.locator('button[data-view="today"]').click();
  await page.waitForTimeout(200);
  results.todayVisible = await page.evaluate(() =>
    document.querySelector('#listView')?.classList.contains('active'));

  await page.locator('button[data-view="dashboard"]').click();
  await page.locator('#newTaskButton').click();
  await page.waitForTimeout(200);
  results.dialogOpens = await page.evaluate(() =>
    document.querySelector('#taskDialog')?.hasAttribute('open'));

  await page.locator('#cancelDialog').click();
  await page.waitForTimeout(200);
  results.dialogCloses = await page.evaluate(() =>
    !document.querySelector('#taskDialog')?.hasAttribute('open'));

  return results;
}
