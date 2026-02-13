# 🛒 ShopBy + Onliner Overlay

<div align="center">

[![en](https://img.shields.io/badge/lang-en-red.svg)](./README.en.md)
[![ru](https://img.shields.io/badge/lang-ru-blue.svg)](../README.md)

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Chrome%20%7C%20Firefox%20-orange)

</div>

---

A browser extension that automatically displays Shop.by prices on Onliner.by product pages.

---

## 🎯 Features

- ✅ **Automatic price search** — shows Shop.by prices directly on Onliner.by
- ⚡ **Fast loading** — results cached for 6 hours
- 🔗 **Direct links** — clicking the price opens Shop.by
- 📊 **Offer count** — shows how many stores sell the product
- 🔒 **Privacy** — does not collect personal data

---

## 📸 Screenshots

<details>
<summary>Click to see examples</summary>

### Product Catalog
Prices are displayed in the product list:
```
COMING SOON
```

### Product Card
Price is added below the main Onliner price:
```
COMING SOON
```

### Favorites
Prices are displayed in the favorites list:

```
COMING SOON
```

### Comparison
Prices are displayed in comparisons:
```
COMING SOON
```

</details>

---

## 🚀 Installation

### Chrome / Edge / Opera / Brave

1. Go to [Chrome Web Store](#) (link will be available after publication)
2. Click "Add to Chrome"
3. Confirm installation

### Firefox

1. Go to [Firefox Add-ons](#) (link will be available after publication)
2. Click "Add to Firefox"
3. Confirm installation

### Install from source (for developers)

See the [Building from source](#️-building-from-source) section

---

## 🔧 Usage

The extension works automatically after installation:

1. Open any page on **catalog.onliner.by** or **www.onliner.by**
2. The extension will automatically find products on the page
3. A green badge with the Shop.by price will appear under each product
4. Clicking the badge opens the product page on Shop.by

**No configuration required!** Everything works out of the box.

---

## 🛠️ Building from source

### System Requirements

- **Operating System:** Windows 10/11, macOS 10.15+, Ubuntu 20.04+ (or any modern Linux)
- **Node.js:** version 16.0.0 or higher ([download](https://nodejs.org/))
- **pnpm:** version 8.0.0 or higher (installed via npm)
- **Free space:** ~500 MB (including node_modules)

### Step 1: Install dependencies

#### 1.1 Install Node.js

**Windows/macOS:**
- Download installer from https://nodejs.org/
- Run the installer
- Check version: `node --version` (should be ≥16.0.0)

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### 1.2 Install pnpm

```bash
npm install -g pnpm
```

Check version:
```bash
pnpm --version
# Should be ≥8.0.0
```

### Step 2: Clone and install

```bash
# If you downloaded the ZIP with source code
unzip source-code.zip
cd shopby-onliner-overlay

# Or if cloning from Git
git clone https://github.com/qFamouse/shopby-onliner-overlay.git
cd shopby-onliner-overlay

# Install dependencies
pnpm install
```

**Installation time:** ~30-60 seconds (depends on internet speed)

### Step 3: Build the extension

#### For Chrome/Edge/Opera/Brave:
```bash
pnpm build
pnpm package
```

#### For Firefox:
```bash
pnpm build:firefox
```

**Build time:** ~10-30 seconds

### Step 4: Check the result

After building, files will be in the `build/` folder:

```
build/
├── chrome-mv3-prod/           # Extension folder for Chrome
│   ├── manifest.json
│   ├── background.js
│   └── ...
├── chrome-mv3-prod.zip        # ZIP for Chrome Web Store publication
│
├── firefox-mv2-prod/          # Extension folder for Firefox
│   ├── manifest.json
│   ├── background.js
│   └── ...
└── firefox-mv2-prod.zip       # ZIP for Firefox Add-ons publication
```

---

## 🔍 How it works

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Content Script                        │
│       (runs on catalog.onliner.by and www.onliner.by)       │
│                                                              │
│  1. Finds product cards on the page                         │
│  2. Extracts product name                                    │
│  3. Checks cache (Plasmo Storage)                           │
│  4. If not in cache → sends request to Background           │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ chrome.runtime.sendMessage()
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Background Worker                         │
│               (bypasses CORS restrictions)                   │
│                                                              │
│  1. Receives request from Content Script                    │
│  2. Makes HTTP request to shop.by/find/                     │
│  3. Parses HTML and extracts price                          │
│  4. Sends result back                                        │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ sendResponse()
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Content Script                            │
│                                                              │
│  1. Receives price from Background                          │
│  2. Saves to cache for 6 hours                              │
│  3. Creates green badge with price                          │
│  4. Inserts onto page                                        │
└─────────────────────────────────────────────────────────────┘
```

### Caching

- Search results are cached for **6 hours**
- Uses `@plasmohq/storage` (wrapper over chrome.storage.local)
- Repeated page loads are **instant** (data taken from cache)
- Cache persists even after browser restart

### Security

- ✅ **No external analytics** — we don't use Google Analytics, Sentry, etc.
- ✅ **No data collection** — we don't collect or transmit personal data
- ✅ **Only necessary permissions** — only `storage` and access to onliner.by/shop.by
- ✅ **Safe HTML** — we use React JSX (automatic escaping)
- ✅ **Open source** — all code is available for review

---

## 🧪 Development

### Development mode

```bash
# Chrome (default)
pnpm dev

# Firefox
pnpm dev:firefox
```

This will start a dev server with hot-reload. Code changes will be applied automatically.

### Loading in browser for testing

**Chrome/Edge/Opera/Brave:**
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked extension"
4. Select the `build/chrome-mv3-dev/` folder

**Firefox:**
1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select the `build/firefox-mv2-dev/manifest.json` file

---

## 🐛 Known Issues

### innerHTML warnings during Firefox validation

When validating the extension for Firefox, warnings about using `innerHTML` may appear. This is a false-positive: Plasmo Framework automatically uses React JSX, which safely escapes all data.

### Some products are not found on Shop.by

The extension searches for products by name. If the name on Onliner differs from Shop.by, the product may not be found. This is a limitation of the Shop.by API (no search by article/SKU).

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file

---

## 🙏 Acknowledgments

- [Plasmo Framework](https://www.plasmo.com/) — for the excellent framework
- [Onliner.by](https://onliner.by/) — the most convenient product catalog
- [Shop.by](https://shop.by/) — the widest product catalog

---

## 📞 Support

If you found a bug or have a suggestion:
1. Open an [Issue on GitHub](https://github.com/qFamouse/shopby-onliner-overlay/issues)

---

## 🔐 Privacy Policy

The extension **does not collect or transmit** personal data:
- ❌ We don't track your activity
- ❌ We don't send analytics
- ❌ We don't use cookies for tracking
- ✅ All data is stored locally in the browser
- ✅ Requests only go to onliner.by and shop.by

More details: [PRIVACY_POLICY.md](PRIVACY_POLICY.md)

---

## ⚖️ Legal Information

This extension is not affiliated with Onliner.by or Shop.by. All trademarks belong to their respective owners.

The extension is provided "as is", without any warranties.

---

**Made with ❤️ for the Belarusian internet**