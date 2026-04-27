# Changelog

## Unreleased — 2026-04-27

### Python & Django support

- Raised `python_requires` to `>=3.10`; added PyPI classifiers for Python 3.10, 3.11, 3.12, 3.13, 3.14
- Added `django>=4.2` optional extra (`pip install autocomplete-light[django]`); added PyPI classifiers for Django 4.2, 5.2, 6.0
- Added `autocomplete_light/apps.py` (`AutocompleteLightConfig`) so `INSTALLED_APPS = ['autocomplete_light']` works and `collectstatic` discovers the assets
- Added `test_django.py` — verifies both static assets are discoverable via Django's `staticfiles` finder under all three supported Django versions

### Package layout fix

- Moved `autocomplete-light.js` and `autocomplete-light.css` into `autocomplete_light/static/autocomplete_light/` (the canonical location that matches what the PyPI release job was building at publish time — source tree and wheel now agree)
- Added `packages=find_packages()` and `package_data` to `setup.py`; removed `include_package_data=True` (superseded by explicit `package_data`)
- `MANIFEST.in` already referenced `autocomplete_light/` correctly; the directory now actually exists in the repo
- Updated `serve.py` to remap `/autocomplete-light.{js,css}` URLs to the new package static path; demo and test URLs are unchanged

### JavaScript fixes

- **`connectedCallback` infinite timer leak** — both `AutocompleteLight` and `AutocompleteSelect` now accept a `retries` argument (default 20) and stop polling after 20 × 100 ms; a misconfigured component no longer leaks timers indefinitely
- **Duplicate class fields** — removed the second `box = null` declaration and the `input = null` field that shadowed the `get input()` getter
- **Unused fields** — removed `bound = false` and `name = null` from `AutocompleteSelect` (declared but never read)
- **Debug stubs removed** — deleted `disconnectedCallback` and `attributeChangedCallback` which only contained `console.log` and never fired correctly (no `observedAttributes` was declared)
- **Deprecated `keyCode`** — `keyboard()` now uses `ev.key` (`'ArrowDown'`, `'ArrowUp'`, `'Tab'`, `'Enter'`, `'Escape'`) instead of numeric `ev.keyCode`
- **`cloneNode(9)`** — corrected to `cloneNode(true)`
- **IE `CustomEvent` fallback** — removed the `document.createEvent` / `initCustomEvent` branch; `new CustomEvent(...)` is used everywhere
- **`addClear` emoji** — replaced the literal `❌` character with the HTML entity `&#10060;` for safer source encoding

### Python helper fixes (`autocomplete_light.py`)

- `retry()` rewritten: removed dead `return wrapper` (reference to undefined name after an unconditional `while True`); replaced bare `except:` with `except Exception:`; loop now terminates after 15 attempts whether the callback raises or simply never returns the expected value; added `time.sleep(0.1)` between attempts to avoid busy-polling the browser

### CI (`gitlab-ci.yml`)

- Added `py310`–`py314` jobs using `python:3.X` official images to verify the package installs cleanly on each supported Python version
- Added `django-42`, `django-52`, `django-60` jobs that install the matching Django version and run `test_django.py`
- Selenium test job now installs via `pip install -e .[test]` instead of listing packages manually
- `pages` deploy job updated to copy assets from `autocomplete_light/static/autocomplete_light/`
- `pypi` deploy job simplified — no longer needs to create the `autocomplete_light/` directory at publish time since it now exists in the repo

### Other fixes

- `package.json` `test` script was pointing at `test.py` (non-existent); corrected to `test_alight.py`
- `package.json` `main` field updated to the new JS path
- `index.html` typo fixed: "check teh HTML source" → "check the HTML source"
