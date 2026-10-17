import {expect,test} from '@playwright/test';
import path from 'node:path';import{chooseFiles,installFilePickerStub}from'../support/file-picker';
test('renders fixed primitive colors and target opacity into actual GPU pixels',async({page})=>{
 await page.setViewportSize({width:1920,height:1080});await installFilePickerStub(page);await page.goto('/');await chooseFiles(page,[path.resolve(import.meta.dirname,'../fixtures/audio/visualizer-v5-avsync-v1.wav')]);await page.getByTestId('header-visualizer-link').click();await page.getByTestId('add-visualizer-element').click();await page.locator('[data-element-type=solid]').click();
 await page.getByLabel('颜色',{exact:true}).fill('#ff0000');await page.getByLabel('颜色',{exact:true}).dispatchEvent('input');await page.getByTestId('toggle-playback').click();
 const canvas=page.getByTestId('visualizer-preview-canvas');await canvas.dispatchEvent('visualizer-sample-center-test');await expect.poll(()=>canvas.getAttribute('data-center-pixel')).toMatch(/^25[0-5],0,0,255$/);
 await page.getByLabel('透明度',{exact:true}).fill('.5');await page.getByLabel('透明度',{exact:true}).dispatchEvent('change');await canvas.dispatchEvent('visualizer-sample-center-test');await expect.poll(()=>canvas.getAttribute('data-center-pixel')).toMatch(/^12[6-9],[0-4],[0-4],255$/);
 await page.mouse.move(20,20);const record=page.getByTestId('start-visualizer-export');await record.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');await expect(record).toBeFocused();await expect.poll(()=>page.locator('.viz-video-controls').evaluate(e=>getComputedStyle(e).opacity)).toBe('1');
 await page.screenshot({path:'test-results/visualizer-solid-pixels.png'});
});
