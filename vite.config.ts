import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Builds the extension into dist/. Load that folder via edge://extensions → "Load unpacked".
// `--mode firefox` builds the Firefox version into dist-firefox/ instead (load it via about:debugging).
export default defineConfig(({ mode }) => {
  const firefox = mode === 'firefox';
  const outDir = firefox ? 'dist-firefox' : 'dist';
  return {
    plugins: [react(), ...(firefox ? [firefoxManifest(outDir)] : [])],
    // Firefox's chrome.* APIs take callbacks; its browser.* ones are the same APIs returning promises, as the code expects.
    define: firefox ? { chrome: 'browser' } : {},
    build: {
      outDir,
      emptyOutDir: true,
      sourcemap: mode === 'development',
      minify: mode !== 'development',
      rollupOptions: {
        input: {
          sidepanel: resolve(__dirname, 'sidepanel.html'),
          library: resolve(__dirname, 'library.html'),
          background: resolve(__dirname, 'src/background.ts'),
        },
        output: {
          // The manifest points at a fixed background.js path, so that entry can't be hashed.
          entryFileNames: (chunk) => (chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'),
        },
      },
    },
    test: {
      environment: 'node',
    },
  };
});

// Firefox runs the background as an event page rather than a service worker, has a sidebar instead of a side panel,
// has no favicon cache, and needs an add-on id.
function firefoxManifest(outDir: string): Plugin {
  return {
    name: 'firefox-manifest',
    closeBundle() {
      const path = resolve(__dirname, outDir, 'manifest.json');
      const { side_panel, minimum_chrome_version: _, background: __, permissions, ...manifest } = JSON.parse(readFileSync(path, 'utf8'));
      const firefox = {
        ...manifest,
        background: { scripts: ['background.js'], type: 'module' },
        sidebar_action: {
          default_panel: side_panel.default_path,
          default_title: manifest.name,
          default_icon: manifest.action.default_icon,
          open_at_install: false,
        },
        permissions: permissions.filter((p: string) => p !== 'sidePanel' && p !== 'favicon'),
        browser_specific_settings: {
          gecko: {
            id: 'bookmark-manager@folia',
            strict_min_version: '140.0',
            // Everything stays in the browser; nothing is sent to us or anyone else.
            data_collection_permissions: { required: ['none'] },
          },
        },
      };
      writeFileSync(path, JSON.stringify(firefox, null, 2));
    },
  };
}
