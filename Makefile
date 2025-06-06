.PHONY: package

package:
	@echo "Packaging src/ into dist/black-screen.zip..."
	@rm -rf dist && mkdir dist
	@cd src && zip -r ../dist/black-screen.zip .
	@echo "✅ Done: dist/black-screen.zip created."
