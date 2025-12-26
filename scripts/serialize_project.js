const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const outputFile = path.join(rootDir, 'project_dump.json');

const ignoreDirs = new Set([
    'node_modules', '.git', '.firebase', 'dist', '.vscode', 'logs',
    'build', 'coverage', '.gemini', 'tmp'
]);

const ignoreFiles = new Set([
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
    'project_dump.json', '.DS_Store', 'project_context.json'
]);

const binaryExtensions = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2',
    '.ttf', '.eot', '.mp4', '.webm', '.mp3', '.wav', '.pdf', '.zip',
    '.tar', '.gz', '.pyc', '.exe', '.dll', '.so', '.dylib'
]);

const projectData = {
    project_name: path.basename(rootDir),
    files: []
};

function walk(dir) {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat && stat.isDirectory()) {
            if (!ignoreDirs.has(file)) {
                walk(filePath);
            }
        } else {
            if (ignoreFiles.has(file)) return;
            const ext = path.extname(file).toLowerCase();
            if (binaryExtensions.has(ext)) return;
            // Skip this script itself
            if (path.resolve(filePath) === __filename) return;

            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const relativePath = path.relative(rootDir, filePath);
                projectData.files.push({
                    path: relativePath,
                    content: content
                });
            } catch (err) {
                console.error(`Error reading ${filePath}:`, err.message);
            }
        }
    });
}

try {
    console.log(`Starting serialization from ${rootDir}`);
    walk(rootDir);

    fs.writeFileSync(outputFile, JSON.stringify(projectData, null, 2), 'utf8');
    console.log(`Project serialized to ${outputFile}`);
    console.log(`Total files: ${projectData.files.length}`);
} catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
}
