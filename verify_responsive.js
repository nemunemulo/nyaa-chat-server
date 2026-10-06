const fs = require('fs');
const path = require('path');

const baseDir = __dirname;
const html = fs.readFileSync(path.join(baseDir, 'public/index.html'), 'utf-8');
const css = fs.readFileSync(path.join(baseDir, 'public/style.css'), 'utf-8');
const js = fs.readFileSync(path.join(baseDir, 'public/app.js'), 'utf-8');

const checks = [
  { name: 'Viewport meta tag with viewport-fit & interactive-widget', pass: html.includes('interactive-widget=resizes-content') && html.includes('viewport-fit=cover') },
  { name: 'appBackdrop overlay in HTML', pass: html.includes('id="appBackdrop"') },
  { name: '100dvh & --app-height in CSS', pass: css.includes('100dvh') && css.includes('--app-height') },
  { name: 'app-layout flex-1 and min-height: 0', pass: css.includes('.app-layout') && css.includes('min-height: 0') },
  { name: 'Tablet & Mobile off-canvas drawers (transform: translateX)', pass: css.includes('@media (max-width: 1024px)') && css.includes('translateX(-100%)') && css.includes('translateX(100%)') },
  { name: 'Safe area inset bottom for modern smartphones', pass: css.includes('safe-area-inset-bottom') },
  { name: 'JS starts sidebars CLOSED by default on mobile/tablet', pass: js.includes('isMobileOrTablet') && js.includes('isLeftSidebarOpen = isMobileOrTablet() ? false :') },
  { name: 'JS visualViewport dynamic resizing handler for on-screen keyboards', pass: js.includes('window.visualViewport') && js.includes('updateAppViewportHeight') },
  { name: 'JS mutual exclusion and auto-close drawers on channel/user click', pass: js.includes('closeAllSidebarsOnMobile()') }
];

let allPassed = true;
checks.forEach(c => {
  if (c.pass) {
    console.log(`✅ [PASS] ${c.name}`);
  } else {
    console.log(`❌ [FAIL] ${c.name}`);
    allPassed = false;
  }
});

if (!allPassed) {
  process.exit(1);
} else {
  console.log('\n🎉 ALL RESPONSIVE UI CHECKS PASSED PERFECTLY! 🎉');
  process.exit(0);
}
