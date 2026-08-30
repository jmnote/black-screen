let hideTimeout = null;
let isButtonHovered = false;
let isButtonFocused = false;
const HIDE_DELAY = 1000;
const fullscreenButton = document.querySelector('.fullscreen-button');

function hideUI() {
    clearTimeout(hideTimeout);
    hideTimeout = null;
    document.body.classList.remove('active');
}

function showUI() {
    document.body.classList.add('active');
    clearTimeout(hideTimeout);
    hideTimeout = null;
    if (!isButtonHovered && !isButtonFocused) {
        hideTimeout = setTimeout(() => {
            hideUI();
        }, HIDE_DELAY);
    }
}

function showUIOnMouseMove() {
    showUI();
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

window.addEventListener('mousemove', showUIOnMouseMove);
window.addEventListener('mousedown', showUI);
window.addEventListener('keydown', showUI);
window.addEventListener('touchstart', showUI, { passive: true });
window.addEventListener('touchmove', showUI, { passive: true });
window.addEventListener('blur', hideUI);

fullscreenButton.addEventListener('click', toggleFullscreen);
fullscreenButton.addEventListener('mouseenter', () => {
    isButtonHovered = true;
    showUI();
});
fullscreenButton.addEventListener('mouseleave', () => {
    isButtonHovered = false;
    showUI();
});
fullscreenButton.addEventListener('focus', () => {
    isButtonFocused = true;
    showUI();
});
fullscreenButton.addEventListener('blur', () => {
    isButtonFocused = false;
    showUI();
});
