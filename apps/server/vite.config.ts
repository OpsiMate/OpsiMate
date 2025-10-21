import { defineConfig } from 'vite'
import { VitePluginNode } from 'vite-plugin-node'

// https://github.com/axe-me/vite-plugin-node
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'
  
  if (isProduction) {
    // Production build - simple ES module build
    return {
      build: {
        target: 'node18',
        outDir: 'dist',
        rollupOptions: {
          input: 'src/index.ts',
          external: [
            'better-sqlite3',
            'express',
            'cors',
            'bcrypt',
            'jsonwebtoken',
            'multer',
            'js-yaml',
            'node-ssh',
            'sshpk',
            '@kubernetes/client-node',
            '@OpsiMate/shared'
          ],
          output: {
            format: 'es',
            entryFileNames: 'index.js',
            chunkFileNames: '[name].js',
            assetFileNames: '[name].[ext]'
          }
        },
        minify: false,
        sourcemap: true,
        ssr: true
      }
    }
  }
  
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
