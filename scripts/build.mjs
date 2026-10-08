import {build} from 'esbuild';
await build({entryPoints:['src/app.js'],bundle:true,format:'esm',target:'es2022',minify:true,outfile:'assets/app.js',legalComments:'eof'});
