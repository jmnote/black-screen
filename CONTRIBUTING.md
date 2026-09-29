# Contributing to Black Screen

Thank you for your interest in contributing to Black Screen! We welcome bug reports, feature suggestions, and code contributions.

---

## Guiding Principles

Before contributing, please keep the project's philosophy in mind:
- **Pure & Minimal**: The core purpose is an instant, distraction-free black screen. Keep UI elements unobtrusive.
- **Zero Runtime Dependencies**: The extension relies solely on vanilla HTML, CSS, and modern JavaScript APIs.
- **Privacy & Security**: Only request necessary permissions. Never transmit or collect user data.

---

## How to Contribute

### 1. Reporting Issues or Requesting Features
- Search existing [Issues](https://github.com/jmnote/black-screen/issues) to see if your bug or feature idea is already being tracked.
- If not, create a new issue with a clear title and description (including steps to reproduce, Chrome version, and OS if reporting a bug).

### 2. Developing Locally
Detailed instructions for setting up the local environment, reloading changes, running build/screenshot scripts, and understanding the codebase architecture are available in:

👉 **[Development Guide (docs/development.md)](docs/development.md)**

Please review the **Design Decisions & Architecture Notes** in that guide before proposing changes to UI behavior, auto-hide timers, or bookmark handling.

### 3. Submitting Pull Requests
1. Fork the repository and create a feature branch from `main`:
   ```bash
   git checkout -b feature/my-feature-name
   ```
2. Make your changes adhering to project conventions (vanilla JS, clean formatting).
3. If your changes affect architectural assumptions or edge-case handling, update [docs/development.md](docs/development.md) accordingly.
4. Test thoroughly in Chrome across multiple interactions (mouse hover/inactivity, keyboard focus, touch devices).
5. Commit your changes with descriptive commit messages.
6. Push to your branch and submit a Pull Request against the `main` branch.
