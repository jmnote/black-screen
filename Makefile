DIST_NAME = black-screen.zip

.PHONY: package
package:
	@echo "Creating $(DIST_NAME)..."
	@rm -f $(DIST_NAME)
	@zip -r $(DIST_NAME) . -x "$(DIST_NAME)" "*.git*"
	@echo "✅ Done: $(DIST_NAME) created. Submit this to the Chrome Web Store."
