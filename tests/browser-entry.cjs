const assert = require('node:assert/strict');
exports.enter = async (page, {legacy=false, play=true}={}) => {
  await page.waitForFunction(()=>window.LumenBoot?.ready);
  assert.equal(await page.evaluate(()=>lumen.mode),'title');
  await page.locator('#title-enter').click();
  await page.waitForFunction(()=>lumen.mode==='map');
  if(!play)return;
  if(legacy){
    // Explicit fixture for the preserved classic-menu regression scenarios.
    // Normal startup is independently asserted as title -> atlas in test-mobile.
    await page.evaluate(()=>lumen.showHome());
  }else{
    await page.locator('[data-place="chant-petits-matins"]').click();
    await page.locator('[data-journey-launch="chant-petits-matins"]').click();
    await page.waitForFunction(()=>lumen.mode==='playing');
  }
};
