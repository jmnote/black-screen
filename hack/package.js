// Packages the extension into dist/black-screen-<version>.zip — the JS
// counterpart to the old `zip` shell command in the Makefile. Using a
// bundled zip library (instead of the `zip` CLI) means this runs the same
// way under `make package` (Linux/macOS) and `./build.ps1 package`
// (Windows), where there's no `zip` binary on PATH.

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const ROOT = path.resolve(__dirname, '..');
const ENTRIES = ['manifest.json', 'black-screen.html', 'black-screen.js', 'service-worker.js', 'LICENSE', 'images'];

function addEntry(archive, entry) {
    const fullPath = path.join(ROOT, entry);
    if (fs.statSync(fullPath).isDirectory()) {
        archive.directory(fullPath, entry);
    } else {
        archive.file(fullPath, { name: entry });
    }
}

async function main() {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
    const version = manifest.version;
    if (!version) {
        throw new Error('Invalid version in manifest.json');
    }

    const distDir = path.join(ROOT, 'dist');
    fs.mkdirSync(distDir, { recursive: true });
    const outPath = path.join(distDir, `black-screen-${version}.zip`);
    fs.rmSync(outPath, { force: true });

    console.log(`Packaging ${path.relative(ROOT, outPath)}...`);

    await new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outPath);
        const archive = archiver('zip', { zlib: { level: 9 } });
        output.on('close', resolve);
        archive.on('error', reject);
        archive.pipe(output);
        for (const entry of ENTRIES) {
            addEntry(archive, entry);
        }
        archive.finalize();
    });

    console.log(`✅ Done: ${path.relative(ROOT, outPath)} created.`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
