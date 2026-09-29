# Black Screen

<p align="center">
  <img src="images/icon-128.png" alt="Install Black Screen from the Chrome Web Store" width="96" height="96" />
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/black-screen/bdcmhoaiaafaadfkfjcpchckgcdpagkj"><img src="https://img.shields.io/chrome-web-store/v/bdcmhoaiaafaadfkfjcpchckgcdpagkj?logo=googlechrome&logoColor=white&label=Chrome%20Web%20Store" alt="Chrome Web Store" /></a>
  <a href="https://chromewebstore.google.com/detail/black-screen/bdcmhoaiaafaadfkfjcpchckgcdpagkj"><img src="https://img.shields.io/chrome-web-store/users/bdcmhoaiaafaadfkfjcpchckgcdpagkj?color=blue" alt="Users" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" alt="License" /></a>
</p>

<p align="center">
  A minimal Chrome extension that replaces your new tab page with a pure black screen.
</p>

---

## Screenshots

<table>
  <tr>
    <td align="center">
      <img src="store/screenshot/screenshot1-default.png" alt="Default View" width="380" /><br/>
      <sub>Pure black, until you move the mouse</sub>
    </td>
    <td align="center">
      <img src="store/screenshot/screenshot2-fullscreen.png" alt="Fullscreen View" width="380" /><br/>
      <sub>Fullscreen — no browser chrome at all</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="store/screenshot/screenshot3-settings.png" alt="Settings" width="380" /><br/>
      <sub>Settings — the only menu there is</sub>
    </td>
    <td align="center">
      <img src="store/screenshot/screenshot4-bookmarks.png" alt="On-screen Bookmarks Bar" width="380" /><br/>
      <sub>On-screen bookmarks bar, turned on from Settings</sub>
    </td>
  </tr>
</table>

## Features

- **Pure Black**: Opens an instant, distraction-free pure black screen in a new tab.
- **Auto-hiding Cursor & Toolbar**: The cursor and on-screen toolbar (fullscreen, bookmarks bar, settings) appear on interaction and automatically fade away after 1 second of inactivity.
- **Fullscreen Toggle**: Use the on-screen button to enter or exit browser fullscreen mode. Press `Esc` to exit fullscreen.
- **Bookmarks Bar**: An on-screen bookmarks bar that mirrors your browser's actual bookmarks bar, since replacing the new tab page hides Chrome's own one. Turn it on from Settings (⋮ menu, top right).
- **Settings**: A single ⋮ menu in the top right — toggle the bookmarks bar and see the installed version. Nothing else to configure.
- **Touch Support**: Touch start and movement reveal the cursor and toolbar on touch-enabled devices.
- **Minimal Permissions**: Only reads your bookmarks and favicons to render the on-screen bookmarks bar — nothing is tracked, sent anywhere, or stored outside your browser.
- **No Clutter**: No tracking, no ads, no unnecessary UI — just black, with a couple of opt-in extras.

## Installation

### From Chrome Web Store
Install directly from the [Chrome Web Store](https://chromewebstore.google.com/detail/black-screen/bdcmhoaiaafaadfkfjcpchckgcdpagkj).

### Manual Installation (For Developers)
1. Clone or download this repository.
2. Open `chrome://extensions/` in Chrome and enable **Developer mode** (top right).
3. Click **Load unpacked** and select the `black-screen` root directory.

## License

This project is licensed under the [Apache License 2.0](LICENSE).
