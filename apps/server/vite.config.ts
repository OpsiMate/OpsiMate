import { defineConfig } from 'vite'
import { VitePluginNode } from 'vite-plugin-node'

// https://github.com/axe-me/vite-plugin-node
export default defineConfig(({ mode }) => {

  // Development build - use vite-plugin-node
  return {
    server: {
      port: 3000,
      host: '0.0.0.0'
    },
    plugins: [
      ...VitePluginNode({
        adapter: 'express',
        appPath: './src/vite-app.ts',
        exportName: 'viteNodeApp',
        tsCompiler: 'esbuild',
        swcOptions: {
          jsc: {
            target: 'es2022'
          }
        }
      })
    ],
    optimizeDeps: {
      exclude: ['better-sqlite3']
    }
  }
})
