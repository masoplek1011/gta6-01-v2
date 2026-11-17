// Solmaris, an open-world crime game for make.fun's gta6-01 bounty (Node 22,
// standard library only). The game is plain static files under game/ —
// game/index.html and its ES modules, no library, no network request — and
// this program hands it in: it copies game/ and screenshots/ from beside
// this file into /output and writes /output/dossier.json with the vendored
// make.fun library, so the judge can read the game.
//
// Play it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The gate's own caps, so a build that would fail the gate fails here too:
// at most 4 screenshots, each at most 256 KiB; game/ at most 993 files and
// 48 MiB in all, no path under it over 1000 bytes. Only text_max_bytes
// changes the dossier's bytes; the rest are guard rails.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
