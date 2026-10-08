import {LiquidGlassWebGLV2} from 'apple-liquid-glass-webgl/v2';
export function createGlass(){
 const stage=document.querySelector('.filter-stage'),canvas=document.querySelector('#glass-nav');
 let glass,frame=0,current;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const fallback=()=>{cancelAnimationFrame(frame);stage.classList.remove('glass-ready');canvas.hidden=true;};
 if(matchMedia('(forced-colors: active), (prefers-reduced-transparency: reduce)').matches||!LiquidGlassWebGLV2.isSupported())return ()=>{};
 try{
  canvas.hidden=false;
  glass=new LiquidGlassWebGLV2(canvas,{autoStart:false,autoResize:false,compositeMode:'replace',backdropUpdate:'static',material:{refraction:.025,dispersion:.015,frost:.02,body:.2,tint:.08,roundness:15},onContextLost:fallback,onContextRestored:()=>{canvas.hidden=false;stage.classList.add('glass-ready');resize();}});
  stage.classList.add('glass-ready');
 }catch{fallback();return ()=>{};}
 const position=()=>{const b=document.querySelector('#filters button[aria-pressed=true]');return b?{x:b.offsetLeft,y:b.offsetTop,w:b.offsetWidth,h:b.offsetHeight}:null;};
 function draw(p){if(!p||glass.contextLost)return;glass.setElements([{id:'selected',shape:'pill',...p}],false);glass.render();}
 function resize(){const w=stage.clientWidth,h=stage.clientHeight,bg=document.createElement('canvas');bg.width=w;bg.height=h;const ctx=bg.getContext('2d'),g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,'#e7eff8');g.addColorStop(.5,'#f5f7fa');g.addColorStop(1,'#e7eff4');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);glass.resize(w,h,Math.min(devicePixelRatio,2));glass.setBackdrop(bg,{update:'static',autoStart:false,shouldRender:false});current=position();draw(current);}
 const observer=new ResizeObserver(resize);observer.observe(stage);resize();
 window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);glass.stop();});
 window.addEventListener('pageshow',resize);
 return ()=>{cancelAnimationFrame(frame);const target=position();if(!target)return;if(reduced.matches||!current){current=target;draw(target);return;}const from={...current},start=performance.now();const tick=now=>{const t=Math.min(1,(now-start)/230),ease=1-(1-t)**3;current=Object.fromEntries(Object.keys(target).map(k=>[k,from[k]+(target[k]-from[k])*ease]));draw(current);if(t<1)frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);};
}
