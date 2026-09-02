let hideTimeout = null;
// While the pointer is over the bookmarks bar's left-hand area (the toggle
// button, the item list, or an open folder dropdown) OR over the fullscreen
// button, the auto-hide timer is suspended so whatever is under the pointer
// doesn't disappear out from under it. These are two independent flags: the
// fullscreen button is protected on its own, regardless of whether the
// bookmarks bar is on.
let isBookmarksBarHovered = false;
let isFullscreenButtonHovered = false;
const HIDE_DELAY = 1000;
const fullscreenButton = document.querySelector('.fullscreen-button');
const bookmarksToggleButton = document.querySelector('.bookmarks-toggle');
const bookmarksList = document.getElementById('bookmarksList');

function hideUI() {
    clearTimeout(hideTimeout);
    hideTimeout = null;
    document.body.classList.remove('active');
}

function showUI() {
    document.body.classList.add('active');
    clearTimeout(hideTimeout);
    hideTimeout = (isBookmarksBarHovered || isFullscreenButtonHovered) ? null : setTimeout(hideUI, HIDE_DELAY);
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
    if (!(window.chrome && chrome.bookmarks && chrome.bookmarks.getTree)) {
        renderEmptyBookmarksNotice('Bookmarks unavailable');
        return;
    }
    try {
        const tree = await chrome.bookmarks.getTree();
        renderBookmarksBar(getBookmarksBarNode(tree));
    } catch (error) {
        renderEmptyBookmarksNotice('Bookmarks unavailable');
    }
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

registerBookmarksHoverProtection(bookmarksToggleButton);

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
    bookmarksToggleButton.setAttribute('aria-pressed', String(isVisible));
}

function toggleBookmarksBar() {
    const isVisible = !document.body.classList.contains('bookmarks-visible');
    setBookmarksVisible(isVisible);
    saveBookmarksVisible(isVisible);
    if (!isVisible) {
        closeAllBookmarkDropdowns();
        // The list/dropdowns just got hidden out from under the pointer;
        // don't leave the hide timer permanently suspended.
        isBookmarksBarHovered = false;
        showUI();
    }
}

bookmarksToggleButton.addEventListener('click', toggleBookmarksBar);

document.addEventListener('click', (event) => {
    if (!event.target.closest('.bookmarks-folder')) {
        closeAllBookmarkDropdowns();
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeAllBookmarkDropdowns();
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
