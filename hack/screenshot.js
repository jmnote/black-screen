// Launches the Black Screen extension in a real (unbranded Chrome for
// Testing, via puppeteer) browser, seeds a few sample bookmarks so the
// on-screen bookmarks bar has something to show, then composites the
// captured page — in a few different states — into a mock Chrome window
// (tab strip + toolbar, rounded corners, drop shadow) floating on a soft
// gradient backdrop, on the Chrome Web Store's smaller allowed canvas,
// 640x400. Deliberately not the larger 1280x800: at that size the mock
// chrome and the extension's own on-screen UI (bookmarks bar, Settings)
// render tiny once shrunk to a README thumbnail, whereas the 640x400 canvas
// makes them all proportionally bigger for free — the chrome/UI's own CSS
// pixel sizes don't change, but there's less canvas for them to be a small
// fraction of. The fullscreen scenario is the exception: it skips that mock
// frame, since real fullscreen has no browser chrome.
//
// Note: this must run against Chrome for Testing / Chromium, not a
// consumer "Google Chrome" install — Google Chrome hard-blocks the
// --load-extension command-line flag ("is not allowed in Google Chrome,
// ignoring"), so unpacked extensions can't be loaded that way there.
// puppeteer's bundled browser doesn't have that restriction.

const fs = require('fs');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer');

const EXT_DIR = path.resolve(__dirname, '..');
const OUT_DIR = path.join(EXT_DIR, 'store', 'screenshot');

// Shown in the Settings screenshot in place of the real manifest version
// (see captureScenario) — a placeholder rather than whatever version
// happens to be installed when these screenshots are regenerated.
const SCREENSHOT_VERSION = '0.0.0';

// Each scenario is the same captured page, just in a different state before
// the shot: the plain default, the bookmarks bar toggled on, and the
// Settings dialog open.
const SCENARIOS = [
    { file: 'screenshot1-default.png', bookmarksVisible: false, openSettings: false },
    { file: 'screenshot4-bookmarks.png', bookmarksVisible: true, openSettings: false },
    { file: 'screenshot3-settings.png', bookmarksVisible: false, openSettings: true },
];

// Chrome Web Store screenshots must be exactly 1280x800 or 640x400 — the
// final canvas stays that size, with the window floating inside it on a
// margin, rather than growing to fit a full-size window.
const FRAME_WIDTH = 640;
const FRAME_HEIGHT = 400;
const WINDOW_MARGIN = 48;
const WINDOW_WIDTH = FRAME_WIDTH - WINDOW_MARGIN * 2;
const WINDOW_HEIGHT = FRAME_HEIGHT - WINDOW_MARGIN * 2;
const TAB_STRIP_HEIGHT = 36;
const TOOLBAR_HEIGHT = 40;
const CONTENT_HEIGHT = WINDOW_HEIGHT - TAB_STRIP_HEIGHT - TOOLBAR_HEIGHT;

const SAMPLE_BOOKMARKS = [
    { title: 'GitHub', url: 'https://github.com' },
    { title: 'Wikipedia', url: 'https://www.wikipedia.org' },
    { title: 'YouTube', url: 'https://www.youtube.com' },
];
const SAMPLE_FOLDER = {
    title: 'News',
    children: [
        { title: 'Hacker News', url: 'https://news.ycombinator.com' },
        { title: 'BBC News', url: 'https://www.bbc.com/news' },
    ],
};

async function seedBookmarks(page) {
    await page.evaluate(
        async (items, folder) => {
            const tree = await chrome.bookmarks.getTree();
            const bar = tree[0].children.find((n) => n.id === '1');
            for (const child of bar.children || []) {
                await chrome.bookmarks.removeTree(child.id);
            }
            for (const item of items) {
                await chrome.bookmarks.create({ parentId: '1', title: item.title, url: item.url });
            }
            const created = await chrome.bookmarks.create({ parentId: '1', title: folder.title });
            for (const item of folder.children) {
                await chrome.bookmarks.create({ parentId: created.id, title: item.title, url: item.url });
            }
        },
        SAMPLE_BOOKMARKS,
        SAMPLE_FOLDER
    );
}

// Builds a static mock of Chrome's own UI (tab strip + toolbar) around the
// captured page, as an HTML page puppeteer can screenshot in turn. No OS
// window chrome (traffic lights / min-max-close) — just the browser UI
// itself, so it isn't tied to any one platform's window styling.
function buildFrameHtml({ contentDataUri, faviconDataUri }) {
    const icon = (d) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
    // Chrome's actual back/forward toolbar icons are filled arrow glyphs
    // (Material Symbols' arrow_back/arrow_forward), not stroked chevrons.
    const filledIcon = (d) => `<svg viewBox="0 0 24 24" width="16" height="16"><path d="${d}" fill="currentColor" /></svg>`;
    const backIcon = filledIcon('M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z');
    const fwdIcon = filledIcon('M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z');
    const reloadIcon = icon('<path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v6h-6" />');
    const searchIcon = icon('<circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />');
    const starIcon = icon('<path d="M12 2l3.1 6.6 7.2.9-5.3 5 1.4 7.2L12 18.3 5.6 21.7 7 14.5 1.7 9.5l7.2-.9z" />');
    const menuIcon = icon('<circle cx="12" cy="5" r="1.3" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="12" cy="19" r="1.3" fill="currentColor" stroke="none" />');

    // Windows-style caption buttons, sitting at the end of the tab strip
    // like Chrome's own window frame does on Windows.
    const captionIcon = (d) => `<svg viewBox="0 0 10 10" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1">${d}</svg>`;
    const minimizeIcon = captionIcon('<line x1="0" y1="5" x2="10" y2="5" />');
    const maximizeIcon = captionIcon('<rect x="0.5" y="0.5" width="9" height="9" />');
    const closeIcon = captionIcon('<line x1="0" y1="0" x2="10" y2="10" /><line x1="10" y1="0" x2="0" y2="10" />');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
        width: ${FRAME_WIDTH}px;
        height: ${FRAME_HEIGHT}px;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    body {
        display: flex;
        align-items: center;
        justify-content: center;
        /* Matches store/assets/promo-marquee.png's backdrop. */
        background: linear-gradient(135deg, #42d292, #647fff);
    }
    .window {
        width: ${WINDOW_WIDTH}px;
        height: ${WINDOW_HEIGHT}px;
        background: #fff;
        border-radius: 10px;
        overflow: hidden;
        box-shadow:
            0 25px 55px rgba(15, 23, 42, 0.35),
            0 6px 16px rgba(15, 23, 42, 0.18);
    }
    .tab-strip {
        height: ${TAB_STRIP_HEIGHT}px;
        background: #dee1e6;
        display: flex;
        align-items: flex-end;
        padding: 6px 8px 0;
        gap: 4px;
    }
    .tab {
        display: flex;
        align-items: center;
        gap: 6px;
        height: 30px;
        max-width: 240px;
        padding: 0 10px;
        background: #fff;
        border-radius: 8px 8px 0 0;
    }
    .tab img { width: 16px; height: 16px; flex: none; }
    .tab span {
        font-size: 12px;
        color: #3c4043;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .tab .close { margin-left: auto; color: #5f6368; font-size: 15px; line-height: 1; }
    .new-tab-btn {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #5f6368;
        font-size: 19px;
        line-height: 1;
    }
    .window-controls {
        margin-left: auto;
        /* Taller than the tab strip's own content row (which sits inset by
           the strip's top padding) so these span the full title-bar height
           and land vertically centered on it — same as real Chrome/Windows
           caption buttons, which aren't confined to the tabs' row. Likewise
           extended past the strip's own right padding so the last button
           sits flush against the window's right edge. */
        height: ${TAB_STRIP_HEIGHT}px;
        margin-right: -8px;
        display: flex;
        align-items: center;
    }
    .window-control {
        width: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #444;
    }
    .toolbar {
        height: ${TOOLBAR_HEIGHT}px;
        background: #fff;
        border-bottom: 1px solid #dadce0;
        display: flex;
        align-items: center;
        padding: 0 12px;
        gap: 12px;
    }
    .nav-icon { color: #9aa0a6; flex: none; }
    .omnibox {
        flex: 1 1 auto;
        height: 28px;
        background: #f1f3f4;
        border-radius: 14px;
        display: flex;
        align-items: center;
        padding: 0 12px;
        gap: 8px;
        color: #5f6368;
    }
    .omnibox .placeholder { font-size: 12.5px; color: #5f6368; }
    .right-icons { display: flex; align-items: center; gap: 16px; margin-left: 4px; color: #5f6368; }
    .avatar { width: 20px; height: 20px; border-radius: 50%; background: #1a73e8; flex: none; }
    .content { width: ${WINDOW_WIDTH}px; height: ${CONTENT_HEIGHT}px; }
    .content img { display: block; width: 100%; height: 100%; }
</style>
</head>
<body>
    <div class="window">
        <div class="tab-strip">
            <div class="tab">
                <img src="${faviconDataUri}" alt="" />
                <span>New Tab</span>
                <span class="close">&times;</span>
            </div>
            <div class="new-tab-btn">+</div>
            <div class="window-controls">
                <div class="window-control">${minimizeIcon}</div>
                <div class="window-control">${maximizeIcon}</div>
                <div class="window-control">${closeIcon}</div>
            </div>
        </div>
        <div class="toolbar">
            <div class="nav-icon">${backIcon}</div>
            <div class="nav-icon">${fwdIcon}</div>
            <div class="nav-icon">${reloadIcon}</div>
            <div class="omnibox">
                ${searchIcon}
                <span class="placeholder">Search Google or type a URL</span>
            </div>
            <div class="right-icons">
                ${starIcon}
                <div class="avatar"></div>
                ${menuIcon}
            </div>
        </div>
        <div class="content"><img src="${contentDataUri}" alt="" /></div>
    </div>
</body>
</html>`;
}

// Real fullscreen has no browser chrome at all, so unlike the other
// scenarios this shot skips the mock frame entirely — it's the raw page,
// filling the full 640x400 canvas, the same as it fills the actual screen.
async function captureFullscreenScreenshot(browser) {
    const page = await browser.newPage();
    await page.setViewport({ width: FRAME_WIDTH, height: FRAME_HEIGHT, deviceScaleFactor: 1 });
    await page.goto('chrome://newtab/', { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.setItem('bookmarksVisible', 'false'));
    await page.reload({ waitUntil: 'networkidle0' });

    await page.mouse.move(FRAME_WIDTH / 2, 10);
    await page.mouse.move(FRAME_WIDTH / 2 + 1, 11);
    await page.waitForSelector('.fullscreen-button');
    await page.click('.fullscreen-button');
    await new Promise((resolve) => setTimeout(resolve, 300));

    const isFullscreen = await page.evaluate(() => Boolean(document.fullscreenElement));
    if (!isFullscreen) {
        throw new Error('Failed to enter fullscreen for the fullscreen screenshot.');
    }

    const outPath = path.join(OUT_DIR, 'screenshot2-fullscreen.png');
    await page.screenshot({ path: outPath });
    await page.close();
    console.log(`Saved ${path.relative(EXT_DIR, outPath)}`);
}

// Puts the already-loaded new tab page into one scenario's state and
// captures its content (not yet wrapped in the mock browser frame).
async function captureScenario(page, { bookmarksVisible, openSettings }) {
    await page.evaluate((visible) => localStorage.setItem('bookmarksVisible', String(visible)), bookmarksVisible);
    await page.reload({ waitUntil: 'networkidle0' });

    // Reveal the top bar.
    await page.mouse.move(WINDOW_WIDTH / 2, 10);
    await page.mouse.move(WINDOW_WIDTH / 2 + 1, 11);
    await page.waitForSelector('.options-toggle');

    if (bookmarksVisible) {
        await page.waitForSelector('#bookmarksList');
        // Hovering the list keeps the auto-hide timer suspended while we shoot.
        await page.hover('#bookmarksList');
        await page.waitForFunction(
            () => document.querySelectorAll('#bookmarksList .bookmarks-item, #bookmarksList .bookmarks-folder').length > 0
        );
    }

    if (openSettings) {
        await page.click('.options-toggle');
        await page.click('.options-dropdown__item[data-action="settings"]');
        await page.waitForSelector('.modal-overlay.open');
        // Overwrite the real manifest version so this screenshot doesn't go
        // stale (or need regenerating) on every version bump.
        await page.evaluate((version) => {
            document.getElementById('settingsVersion').textContent = `Black Screen v${version}`;
        }, SCREENSHOT_VERSION);
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
    return page.screenshot({ encoding: 'base64' });
}

async function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'black-screen-screenshot-'));

    const browser = await puppeteer.launch({
        headless: true,
        ignoreDefaultArgs: ['--disable-extensions', '--disable-component-extensions-with-background-pages'],
        args: [
            `--load-extension=${EXT_DIR}`,
            `--user-data-dir=${profileDir}`,
            '--no-first-run',
            '--no-default-browser-check',
            `--window-size=${WINDOW_WIDTH},${CONTENT_HEIGHT + 100}`,
        ],
        defaultViewport: { width: WINDOW_WIDTH, height: CONTENT_HEIGHT },
    });

    try {
        const page = await browser.newPage();
        await page.goto('chrome://newtab/', { waitUntil: 'networkidle0' });

        const hasBookmarksApi = await page.evaluate(() => Boolean(window.chrome && chrome.bookmarks));
        if (!hasBookmarksApi) {
            throw new Error('The extension did not load as the new tab override — chrome.bookmarks unavailable.');
        }

        await seedBookmarks(page);
        const faviconBase64 = fs.readFileSync(path.join(EXT_DIR, 'images', 'icon-16.png')).toString('base64');

        for (const scenario of SCENARIOS) {
            const contentBase64 = await captureScenario(page, scenario);

            const framePage = await browser.newPage();
            await framePage.setViewport({ width: FRAME_WIDTH, height: FRAME_HEIGHT, deviceScaleFactor: 1 });
            await framePage.setContent(
                buildFrameHtml({
                    contentDataUri: `data:image/png;base64,${contentBase64}`,
                    faviconDataUri: `data:image/png;base64,${faviconBase64}`,
                }),
                { waitUntil: 'load' }
            );
            const outPath = path.join(OUT_DIR, scenario.file);
            await framePage.screenshot({ path: outPath });
            await framePage.close();
            console.log(`Saved ${path.relative(EXT_DIR, outPath)}`);
        }

        await captureFullscreenScreenshot(browser);
    } finally {
        await browser.close();
        fs.rmSync(profileDir, { recursive: true, force: true });
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
