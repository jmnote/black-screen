let hideTimeout = null;
// While the pointer is over the bookmarks bar's item list (or an open
// folder dropdown), the options menu, or the fullscreen button, the
// auto-hide timer is suspended so whatever is under the pointer doesn't
// disappear out from under it. These are independent flags: each area is
// protected on its own, regardless of the others' state.
let isBookmarksBarHovered = false;
let isFullscreenButtonHovered = false;
let isOptionsMenuHovered = false;
let isSettingsModalOpen = false;
const HIDE_DELAY = 1000;
const fullscreenButton = document.querySelector('.fullscreen-button');
const bookmarksList = document.getElementById('bookmarksList');
const optionsMenu = document.querySelector('.options-menu');
const optionsToggleButton = document.querySelector('.options-toggle');
const optionsDropdown = document.querySelector('.options-dropdown');
const settingsMenuItem = document.querySelector('.options-dropdown__item[data-action="settings"]');
const settingsOverlay = document.getElementById('settingsOverlay');
const settingsCloseButton = document.querySelector('.modal__close');
const settingsBookmarksVisibleInput = document.getElementById('settingsBookmarksVisible');
const settingsVersion = document.getElementById('settingsVersion');

function hideUI() {
    clearTimeout(hideTimeout);
    hideTimeout = null;
    document.body.classList.remove('active');
    // A clicked button keeps browser focus after the click (without a
    // visible focus ring), and `.top-bar:focus-within` — kept so keyboard
    // users tabbing through the bar stay visible — would otherwise hold the
    // bar up forever once that happens. Only clear that kind of leftover
    // focus: a genuinely keyboard-focused element (:focus-visible) keeps
    // its :focus-within protection instead of losing focus out from under
    // whoever tabbed to it.
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body && !active.matches(':focus-visible')) {
        active.blur();
    }
}

function showUI() {
    document.body.classList.add('active');
    clearTimeout(hideTimeout);
    hideTimeout =
        (isBookmarksBarHovered || isFullscreenButtonHovered || isOptionsMenuHovered || isSettingsModalOpen)
            ? null
            : setTimeout(hideUI, HIDE_DELAY);
}

function registerHoverProtection(element, setHovered) {
    element.addEventListener('mouseenter', () => {
        setHovered(true);
        showUI();
    });
    element.addEventListener('mouseleave', () => {
        setHovered(false);
        showUI();
    });
}

function registerBookmarksHoverProtection(element) {
    registerHoverProtection(element, (hovered) => {
        isBookmarksBarHovered = hovered;
    });
}

async function toggleFullscreen() {
    try {
        if (document.fullscreenElement) {
            await document.exitFullscreen();
        } else {
            await document.documentElement.requestFullscreen();
        }
    } catch (error) {
        // Fullscreen can be denied by the browser or the current context.
        // The black screen remains usable in either case.
    }
}

function handleFullscreenChange() {
    fullscreenButton.setAttribute('aria-pressed', String(Boolean(document.fullscreenElement)));
    showUI();
}

function faviconUrl(pageUrl) {
    const url = new URL(chrome.runtime.getURL('/_favicon/'));
    url.searchParams.set('pageUrl', pageUrl);
    url.searchParams.set('size', '32');
    return url.toString();
}

function createBookmarkLink(node) {
    const link = document.createElement('a');
    link.className = 'bookmarks-item';
    link.href = node.url;
    link.title = node.title || node.url;

    const icon = document.createElement('img');
    icon.className = 'bookmarks-item__icon';
    icon.src = faviconUrl(node.url);
    icon.alt = '';
    icon.addEventListener('error', () => {
        icon.style.visibility = 'hidden';
    });

    const label = document.createElement('span');
    label.className = 'bookmarks-item__label';
    label.textContent = node.title || node.url;

    link.append(icon, label);
    registerBookmarksHoverProtection(link);
    return link;
}

function createFolderIcon() {
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    icon.classList.add('bookmarks-folder__icon');
    const iconPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    iconPath.setAttribute('d', 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z');
    icon.appendChild(iconPath);
    return icon;
}

function closeFolder(wrapper) {
    wrapper.classList.remove('open');
    const trigger = wrapper.querySelector(':scope > button');
    if (trigger) {
        trigger.setAttribute('aria-expanded', 'false');
    }
}

function closeAllBookmarkDropdowns() {
    document.querySelectorAll('.bookmarks-folder.open').forEach(closeFolder);
}

function closeDropdownTree(wrapper) {
    // Closes this folder and any submenus still open inside it.
    closeFolder(wrapper);
    wrapper.querySelectorAll('.bookmarks-folder.open').forEach(closeFolder);
}

function closeSiblingDropdowns(wrapper) {
    // Closing/opening a folder shouldn't collapse its ancestor chain — only
    // other folders at the same level (inside the same parent list/dropdown).
    const parent = wrapper.parentElement;
    if (!parent) {
        return;
    }
    Array.from(parent.children).forEach((sibling) => {
        if (sibling !== wrapper && sibling.classList.contains('bookmarks-folder')) {
            closeDropdownTree(sibling);
        }
    });
}

function positionBookmarkDropdown(trigger, dropdown, placement) {
    // The dropdown is position:fixed (so the bar's horizontal scroll
    // container, or a parent dropdown's scroll, can't clip it), so its
    // coordinates have to be computed in JS instead of via CSS positioning
    // relative to an ancestor.
    const triggerRect = trigger.getBoundingClientRect();

    if (placement === 'side') {
        // A submenu opened from inside another dropdown: cascade to the
        // right of that parent panel, like Chrome's own bookmark menus.
        const parentDropdown = trigger.closest('.bookmarks-dropdown');
        const parentRect = parentDropdown ? parentDropdown.getBoundingClientRect() : triggerRect;
        dropdown.style.left = `${parentRect.right + 4}px`;
        dropdown.style.top = `${triggerRect.top}px`;

        let dropdownRect = dropdown.getBoundingClientRect();
        if (dropdownRect.right > window.innerWidth - 8) {
            // No room on the right — flip to the parent panel's left side.
            dropdown.style.left = `${Math.max(parentRect.left - dropdownRect.width - 4, 8)}px`;
        }
        dropdownRect = dropdown.getBoundingClientRect();
        const overflowBottom = dropdownRect.bottom - (window.innerHeight - 8);
        if (overflowBottom > 0) {
            dropdown.style.top = `${Math.max(triggerRect.top - overflowBottom, 8)}px`;
        }
        return;
    }

    // Top-level bar trigger: open directly below it.
    dropdown.style.left = `${triggerRect.left}px`;
    dropdown.style.top = `${triggerRect.bottom + 4}px`;

    const dropdownRect = dropdown.getBoundingClientRect();
    const overflowRight = dropdownRect.right - (window.innerWidth - 8);
    if (overflowRight > 0) {
        dropdown.style.left = `${Math.max(triggerRect.left - overflowRight, 8)}px`;
    }
}

function populateDropdown(dropdown, children) {
    if (!children.length) {
        const empty = document.createElement('span');
        empty.className = 'bookmarks-dropdown__empty';
        empty.textContent = 'Empty';
        dropdown.appendChild(empty);
        return;
    }
    children.forEach((child) => {
        dropdown.appendChild(child.url ? createBookmarkLink(child) : createBookmarkFolderNode(child, 'side'));
    });
}

// Builds a folder as an openable menu, for both the top-level bar (a
// button that drops a panel below it) and folders nested inside another
// dropdown (a menu row whose submenu cascades to the side) — recursing for
// however many levels deep the bookmarks actually go, same as Chrome's own
// bookmarks bar.
function createBookmarkFolderNode(node, placement) {
    const wrapper = document.createElement('div');
    wrapper.className = 'bookmarks-folder';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = placement === 'side' ? 'bookmarks-dropdown__folder-trigger' : 'bookmarks-folder__trigger';
    trigger.title = node.title || 'Folder';
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');

    const label = document.createElement('span');
    label.className = 'bookmarks-folder__label';
    label.textContent = node.title || 'Folder';

    trigger.append(createFolderIcon(), label);

    if (placement === 'side') {
        const chevron = document.createElement('span');
        chevron.className = 'bookmarks-dropdown__folder-trigger__chevron';
        chevron.textContent = '›';
        chevron.setAttribute('aria-hidden', 'true');
        trigger.appendChild(chevron);
    }

    const dropdown = document.createElement('div');
    dropdown.className = 'bookmarks-dropdown';
    registerBookmarksHoverProtection(dropdown);
    populateDropdown(dropdown, node.children || []);

    const openFolder = () => {
        closeSiblingDropdowns(wrapper);
        wrapper.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
        positionBookmarkDropdown(trigger, dropdown, placement);
    };

    trigger.addEventListener('click', (event) => {
        event.stopPropagation();
        if (wrapper.classList.contains('open')) {
            closeDropdownTree(wrapper);
        } else {
            openFolder();
        }
    });

    if (placement === 'side') {
        // Nested submenus (everything past the top-level bar button) open on
        // hover, like a real cascading menu — clicking still works too, for
        // keyboard/touch use.
        trigger.addEventListener('mouseenter', () => {
            if (!wrapper.classList.contains('open')) {
                openFolder();
            }
        });
    }

    wrapper.append(trigger, dropdown);
    registerBookmarksHoverProtection(wrapper);
    return wrapper;
}

function createBookmarkFolder(node) {
    return createBookmarkFolderNode(node, 'below');
}

function renderEmptyBookmarksNotice(text) {
    bookmarksList.innerHTML = '';
    const notice = document.createElement('span');
    notice.className = 'bookmarks-bar__empty';
    notice.textContent = text;
    bookmarksList.appendChild(notice);
}

function renderBookmarksBar(node) {
    const children = (node && node.children) || [];
    if (!children.length) {
        renderEmptyBookmarksNotice('No bookmarks');
        return;
    }
    bookmarksList.innerHTML = '';
    children.forEach((child) => {
        bookmarksList.appendChild(child.url ? createBookmarkLink(child) : createBookmarkFolder(child));
    });
}

function getBookmarksBarNode(tree) {
    const root = tree[0];
    const topLevel = (root && root.children) || [];
    // Chrome's Bookmarks Bar node has a stable id of "1".
    return (
        topLevel.find((node) => node.id === '1') ||
        topLevel.find((node) => node.folderType === 'bookmarks-bar') ||
        topLevel.find((node) => !node.url) ||
        null
    );
}

async function loadBookmarksBar() {
    // Re-rendering below wipes and rebuilds the bookmark elements, including
    // any that's currently hovered — its mouseleave never fires since it's
    // removed rather than actually left, so the hover-protection flag it set
    // would otherwise stay stuck true and hold the top UI visible forever.
    // Reset it and let a mouseenter on the new elements set it again if the
    // pointer is still resting over the bar.
    isBookmarksBarHovered = false;
    if (!(window.chrome && chrome.bookmarks && chrome.bookmarks.getTree)) {
        renderEmptyBookmarksNotice('Bookmarks unavailable');
        showUI();
        return;
    }
    try {
        const tree = await chrome.bookmarks.getTree();
        renderBookmarksBar(getBookmarksBarNode(tree));
    } catch (error) {
        renderEmptyBookmarksNotice('Bookmarks unavailable');
    }
    showUI();
}

// Keep the bar in sync with bookmark changes made elsewhere (Chrome's own
// bookmarks UI, sync from another device, etc.) instead of only reflecting
// whatever the tree looked like when this tab first loaded. A full re-fetch
// is simplest and cheap enough — these events fire rarely compared to a
// user's mouse movements.
if (window.chrome && chrome.bookmarks && chrome.bookmarks.onCreated) {
    chrome.bookmarks.onCreated.addListener(loadBookmarksBar);
    chrome.bookmarks.onRemoved.addListener(loadBookmarksBar);
    chrome.bookmarks.onChanged.addListener(loadBookmarksBar);
    chrome.bookmarks.onMoved.addListener(loadBookmarksBar);
    chrome.bookmarks.onChildrenReordered.addListener(loadBookmarksBar);
    chrome.bookmarks.onImportEnded.addListener(loadBookmarksBar);
}

window.addEventListener('mousemove', showUI);
window.addEventListener('mousedown', showUI);
window.addEventListener('keydown', showUI);
window.addEventListener('touchstart', showUI, { passive: true });
window.addEventListener('touchmove', showUI, { passive: true });
window.addEventListener('blur', hideUI);
document.addEventListener('fullscreenchange', handleFullscreenChange);

fullscreenButton.addEventListener('click', toggleFullscreen);
registerHoverProtection(fullscreenButton, (hovered) => {
    isFullscreenButtonHovered = hovered;
});

// Covers the toggle button and the open dropdown together, the same way a
// bookmarks folder's wrapper does — otherwise the bar can fade out mid-menu
// while the pointer is resting right on it.
registerHoverProtection(optionsMenu, (hovered) => {
    isOptionsMenuHovered = hovered;
});

// Deliberately not on bookmarksList itself: hover protection is scoped to
// actual bookmark items/folders (and their dropdowns), not the empty gaps
// between them or the plain-text "No bookmarks" notice — those aren't
// interactive elements, so they shouldn't act like one.

const BOOKMARKS_VISIBLE_STORAGE_KEY = 'bookmarksVisible';

function loadStoredBookmarksVisible() {
    try {
        return localStorage.getItem(BOOKMARKS_VISIBLE_STORAGE_KEY) === 'true';
    } catch (error) {
        // Storage can be unavailable (e.g. disabled by policy); just fall
        // back to the default (hidden) state for this tab.
        return false;
    }
}

function saveBookmarksVisible(isVisible) {
    try {
        localStorage.setItem(BOOKMARKS_VISIBLE_STORAGE_KEY, String(isVisible));
    } catch (error) {
        // Nothing to do — the toggle still works for the current tab, it
        // just won't be remembered for the next one.
    }
}

function setBookmarksVisible(isVisible) {
    document.body.classList.toggle('bookmarks-visible', isVisible);
}

function closeOptionsMenu() {
    optionsDropdown.classList.remove('open');
    optionsToggleButton.setAttribute('aria-expanded', 'false');
}

function toggleOptionsMenu() {
    const isOpen = optionsDropdown.classList.contains('open');
    if (isOpen) {
        closeOptionsMenu();
    } else {
        optionsDropdown.classList.add('open');
        optionsToggleButton.setAttribute('aria-expanded', 'true');
    }
}

function loadVersion() {
    try {
        settingsVersion.textContent = `Black Screen v${chrome.runtime.getManifest().version}`;
    } catch (error) {
        settingsVersion.textContent = '';
    }
}

function openSettingsModal() {
    closeOptionsMenu();
    settingsBookmarksVisibleInput.checked = document.body.classList.contains('bookmarks-visible');
    settingsOverlay.classList.add('open');
    isSettingsModalOpen = true;
    showUI();
    // Otherwise Tab would still walk through whatever's behind the modal.
    settingsBookmarksVisibleInput.focus();
}

function closeSettingsModal() {
    settingsOverlay.classList.remove('open');
    isSettingsModalOpen = false;
    showUI();
    // Return focus to what opened the modal, rather than dropping it.
    optionsToggleButton.focus();
}

optionsToggleButton.addEventListener('click', () => {
    // No stopPropagation here (unlike the bookmarks folder triggers): this
    // click needs to reach the document-level handler below so opening the
    // options menu also closes any open bookmarks folder dropdown. The
    // handler's own `.closest('.options-menu')` check already keeps it from
    // closing the menu this same click just opened.
    toggleOptionsMenu();
});

settingsMenuItem.addEventListener('click', openSettingsModal);
settingsCloseButton.addEventListener('click', closeSettingsModal);

settingsOverlay.addEventListener('click', (event) => {
    if (event.target === settingsOverlay) {
        closeSettingsModal();
    }
});

settingsBookmarksVisibleInput.addEventListener('change', () => {
    const isVisible = settingsBookmarksVisibleInput.checked;
    setBookmarksVisible(isVisible);
    saveBookmarksVisible(isVisible);
    if (!isVisible) {
        closeAllBookmarkDropdowns();
        // The list/dropdowns just got hidden out from under the pointer;
        // don't leave the hide timer permanently suspended.
        isBookmarksBarHovered = false;
        showUI();
    }
});

document.addEventListener('click', (event) => {
    if (!event.target.closest('.bookmarks-folder')) {
        closeAllBookmarkDropdowns();
    }
    if (!event.target.closest('.options-menu')) {
        closeOptionsMenu();
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeAllBookmarkDropdowns();
        closeOptionsMenu();
        if (settingsOverlay.classList.contains('open')) {
            closeSettingsModal();
        }
    }
});

function getSettingsModalFocusables() {
    return Array.from(
        settingsOverlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter((el) => !el.disabled && el.offsetParent !== null);
}

// aria-modal="true" promises Tab/Shift+Tab stay inside the dialog. Nothing
// else enforces that on its own, so cycle focus between the modal's first
// and last focusable elements manually while it's open.
document.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || !isSettingsModalOpen) {
        return;
    }
    const focusables = getSettingsModalFocusables();
    if (!focusables.length) {
        return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
});

// An open dropdown's position is computed once, from the trigger's
// coordinates at that moment. Scrolling the bar or resizing the window
// would leave it floating in the wrong spot, so just close it instead of
// tracking and repositioning it continuously.
window.addEventListener('resize', closeAllBookmarkDropdowns);
bookmarksList.addEventListener('scroll', closeAllBookmarkDropdowns);

// Windows' default mouse wheel scrolls vertically; redirect that to
// horizontal scrolling so the (vertically short) bookmarks bar can be
// wheel-scrolled without holding Shift.
bookmarksList.addEventListener('wheel', (event) => {
    if (event.deltaY === 0) {
        return;
    }
    bookmarksList.scrollLeft += event.deltaY;
    event.preventDefault();
});

setBookmarksVisible(loadStoredBookmarksVisible());
loadBookmarksBar();
loadVersion();
