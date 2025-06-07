.PHONY: package

package:
	@echo "Packaging dist/black-screen.zip..."
	@rm -rf dist && mkdir dist
	@zip -r dist/black-screen.zip . -x ".git/*" "dist/*" "store/*"
	@echo "✅ Done: dist/black-screen.zip created."
