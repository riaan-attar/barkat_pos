import { defineConfig } from '@vite-pwa/assets-generator/config'

const bg = '#92400e'
// Run `npm run icons` after editing public/icon.svg.
export default defineConfig({
  preset: {
    transparent: { sizes: [64, 192, 512], favicons: [[48, 'favicon.ico']] },
    maskable: { sizes: [512], padding: 0, resizeOptions: { background: bg } },
    apple: { sizes: [180], padding: 0, resizeOptions: { background: bg } },
  },
  images: ['public/icon.svg'],
})
