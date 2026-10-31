import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],define:{'process.env.NODE_ENV':JSON.stringify('production')},base:'./',build:{outDir:'extension/build',emptyOutDir:true,cssCodeSplit:false,lib:{entry:'src/main.tsx',formats:['es'],fileName:()=> 'app.js'},rollupOptions:{output:{assetFileNames:'app.[ext]'}}}});
