import {createGlass} from './glass.js';
const $=id=>document.getElementById(id);
const groups=[
 ['all','全部界面','从首页到通关补给，按界面查看入口、操作、状态和动效。'],
 ['home','主页','开始、继续游戏与设置。音量控制集中在设置中。'],
 ['play','局内操作','查看生命、得分和投放次数；使用道具，调整快捷栏与暂存顺序。'],
 ['guide','图鉴与规则','通过演示和效果说明了解道具与特殊方块，查看投放与消除规则。'],
 ['rewards','通关与补给','先结算金币，再进入补给站领取道具或特殊方块。'],
 ['shop','商店','筛选商品，查看效果和持有数量，购买后更新金币与价格。'],
 ['recovery','失败与复活','投放次数用尽后，可观看广告复活或重新开始。']
];
let screens=[],filtered=[],selected=0,opener,moveGlass=()=>{};
function text(id,value){$(id).textContent=value;}
function show(index){selected=index;const s=filtered[index];text('viewer-title',s.title);text('viewer-description',s.description);text('viewer-entry',s.entry);text('viewer-state',s.state);text('viewer-motion',s.motion);text('viewer-position',`${index+1} / ${filtered.length}`);$('viewer-image').src=s.image;$('viewer-image').alt=s.title;$('original-image').href=s.image;$('viewer-actions').closest('section').hidden=s.actions.length===0;$('viewer-actions').replaceChildren(...(s.buttons||s.actions.map(label=>({label}))).map(a=>{const li=document.createElement('li');li.textContent=a.effect?`${a.label}：${a.effect}`:a.label;return li;}));$('previous-screen').disabled=index===0;$('next-screen').disabled=index===filtered.length-1;document.querySelector('.viewer-body').scrollTop=0;}
function filter(id){const group=groups.find(g=>g[0]===id);filtered=screens.filter(s=>id==='all'||s.group===id);text('group-title',group[1]);text('group-summary',group[2]);text('count',`${filtered.length} 张界面`);document.querySelectorAll('#filters button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.group===id)));
 $('screens').replaceChildren(...filtered.map((s,index)=>{const card=document.createElement('button');card.className='screen-card';card.type='button';card.setAttribute('aria-label',`查看${s.title}的截图与说明`);const frame=document.createElement('span');frame.className='image-frame';const img=new Image();img.src=s.image;img.alt=s.title;img.width=390;img.height=844;img.loading=index<5?'eager':'lazy';img.decoding='async';frame.append(img);card.append(frame);for(const [cls,value] of [['card-title',s.title],['card-description',s.description]]){const el=document.createElement('span');el.className=cls;el.textContent=value;card.append(el);}card.addEventListener('click',()=>{opener=card;show(index);$('viewer').showModal();});return card;}));moveGlass();}
$('close-viewer').addEventListener('click',()=>$('viewer').close());$('viewer').addEventListener('close',()=>opener?.focus());$('viewer').addEventListener('click',event=>{if(event.target!==$('viewer'))return;const r=$('viewer').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('viewer').close();});
$('previous-screen').addEventListener('click',()=>show(selected-1));$('next-screen').addEventListener('click',()=>show(selected+1));$('viewer').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'&&selected>0){e.preventDefault();show(selected-1);}if(e.key==='ArrowRight'&&selected<filtered.length-1){e.preventDefault();show(selected+1);}});
try{const response=await fetch('./data/screens.json');if(!response.ok)throw Error('screens');screens=await response.json();for(const [id,label] of groups){const button=document.createElement('button');button.type='button';button.dataset.group=id;button.textContent=label;button.addEventListener('click',()=>filter(id));$('filters').append(button);}filter('all');moveGlass=createGlass();}catch(error){$('load-error').hidden=false;text('count','截图载入失败');console.error(error);}

