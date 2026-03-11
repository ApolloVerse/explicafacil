import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('pdfjs-dist')) return 'pdf';
          if (id.includes('tesseract')) return 'ocr';
          if (id.includes('mammoth')) return 'docx';
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
})
