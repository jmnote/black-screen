.PHONY: package screenshot

# The actual logic lives in hack/*.js (see build.ps1 for the Windows
# equivalent) so both entry points install the same deps and run the same
# code instead of drifting apart.
package:
	@cd hack && npm install --no-audit --no-fund && npm run --silent package

screenshot:
	@cd hack && npm install --no-audit --no-fund && npm run --silent screenshot
