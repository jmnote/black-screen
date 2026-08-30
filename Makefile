.PHONY: package

VERSION := $(shell jq -r '.version' manifest.json)
PACKAGE := dist/black-screen-$(VERSION).zip

package:
	@echo "Packaging $(PACKAGE)..."
	@mkdir -p dist
	@rm -f $(PACKAGE)
	@zip -r $(PACKAGE) manifest.json black-screen.html black-screen.js service-worker.js LICENSE images
	@echo "✅ Done: $(PACKAGE) created."
