let hideTimeout = null;
// Each area suspends the auto-hide timer independently while hovered, so
// whatever's under the pointer doesn't disappear out from under it.
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
    // Clear leftover focus from a click (not a real keyboard focus) so it
    // can't hold the bar up via :focus-within forever. See docs/development.md.
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body && !active.matches(':focus-visible')) {
        active.blur();
    }
}

function showUI() {
    document.body.classList.add('active');
    refreshHideTimer();
}

// Re-evaluates the hide timer against the current hover/modal flags without
// making the UI visible — unlike showUI(), a no-op while it's already
// hidden. Used where a flag can change without user interaction (e.g. a
// bookmarks re-render resetting isBookmarksBarHovered), so that doesn't
// itself pop the toolbar up.
function refreshHideTimer() {
    if (!document.body.classList.contains('active')) {
        return;
    }
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
    closeFolder(wrapper);
    wrapper.querySelectorAll('.bookmarks-folder.open').forEach(closeFolder);
}

function closeSiblingDropdowns(wrapper) {
    // Only collapse sibling folders at the same level, not the ancestor chain.
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

// The dropdown is position:fixed (so scroll containers can't clip it), so
// its coordinates are computed in JS instead of via CSS. See docs/development.md.
function positionBookmarkDropdown(trigger, dropdown, placement) {
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

// Builds a folder as an openable menu: a top-level bar button ('below') or
// a nested cascading submenu row ('side'), recursing for however many
// levels deep the bookmarks go.
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
        // Nested submenus open on hover, like a real cascading menu; click still works too.
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
    // Re-rendering replaces any hovered element without a mouseleave firing,
    // so reset the stuck hover flag here. See docs/development.md.
    isBookmarksBarHovered = false;
    if (!(window.chrome && chrome.bookmarks && chrome.bookmarks.getTree)) {
        renderEmptyBookmarksNotice('Bookmarks unavailable');
        refreshHideTimer();
        return;
    }
    try {
        const tree = await chrome.bookmarks.getTree();
        renderBookmarksBar(getBookmarksBarNode(tree));
    } catch (error) {
        renderEmptyBookmarksNotice('Bookmarks unavailable');
    }
    refreshHideTimer();
}

// Keep the bar in sync with bookmark changes made elsewhere (Chrome's own UI,
// sync from another device, etc.) by re-fetching the whole tree on any change.
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

// Covers the toggle button and its dropdown together, so the bar doesn't
// fade out mid-menu while the pointer is resting on it.
registerHoverProtection(optionsMenu, (hovered) => {
    isOptionsMenuHovered = hovered;
});

// Deliberately not on bookmarksList itself — see docs/development.md.

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
    // No stopPropagation: this needs to reach the document click handler
    // below, which closes bookmark dropdowns (its own .options-menu check
    // keeps it from closing the menu this same click just opened).
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

// Manual focus trap for the settings modal — see docs/development.md.
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

// A dropdown's position is computed once; close it instead of repositioning
// it on scroll/resize.
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
