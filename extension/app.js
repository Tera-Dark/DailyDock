const KEY="dailydock.tasks";
const $=s=>document.querySelector(s);
const pad=n=>String(n).padStart(2,"0");
const day=(d=new Date())=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const today=day();
const popup=document.body.classList.contains("popup");
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const urlSafe=s=>{try{const u=new URL(s);return ["https:","http:"].includes(u.protocol)?u.href:"";}catch{return ""}};
const uuid=()=>globalThis.crypto?.randomUUID?.()||Date.now()+"-"+Math.random().toString(36).slice(2);
let tasks=[];
let editing=null;
let filter="all";
const due=(t,d=new Date())=>{
  if(t.repeat==="daily")return true;
  if(t.repeat==="weekly")return (t.weekdays||[]).includes(d.getDay());
  return !t.date || t.date<=day(d);
};
const done=t=>(t.completed||[]).includes(t.repeat==="once"?"__once__":today);
const visible=()=>tasks.filter(t=>due(t)).sort((a,b)=>(done(a)-done(b))||((a.time||"99:99").localeCompare(b.time||"99:99"))||(a.createdAt||0)-(b.createdAt||0));
async function load(){const v=await chrome.storage.local.get(KEY);tasks=Array.isArray(v[KEY])?v[KEY]:[];render()}
async function save(){await chrome.storage.local.set({[KEY]:tasks});render()}
async function toggle(id){tasks=tasks.map(t=>t.id!==id?t:{...t,completed:done(t)?(t.completed||[]).filter(x=>x!==(t.repeat==="once"?"__once__":today)):[...(t.completed||[]),t.repeat==="once"?"__once__":today]});await save()}
const meta=t=>[t.category||"待办",t.repeat==="daily"?"每天":t.repeat==="weekly"?"每周 "+(t.weekdays||[]).map(x=>"日一二三四五六"[x]).join("、"):"单次",t.time||"",t.remind?"🔔":""].filter(Boolean).join(" · ");
const line=t=>`<div class="item ${done(t)?"done":""}"><input class="check" type="checkbox" data-toggle="${esc(t.id)}" aria-label="完成 ${esc(t.title)}" ${done(t)?"checked":""}><div class="detail"><div class="name">${esc(t.title)}</div><div class="meta">${esc(meta(t))}</div></div><div class="actions">${t.url?`<button class="btn small" data-open="${esc(t.id)}">打开</button>`:""}${!popup?`<button class="btn small" data-edit="${esc(t.id)}">编辑</button><button class="btn small" data-delete="${esc(t.id)}">删除</button>`:""}</div></div>`;
function render(){
  const list=visible(),count=list.filter(done).length;
  const shown=filter==="all"?list:filter==="pending"?list.filter(x=>!done(x)):list.filter(done);
  const box=$("#app");
  box.innerHTML=`<main class="layout">
  <header class="header"><div><div class="brand">DailyDock <span style="font-size:17px">✳</span></div><div class="subtitle">每天的小事，轻松完成</div></div><div class="top-actions">${popup?`<button class="btn primary" data-manage>管理任务 ↗</button>`:`<button class="btn" data-export>导出备份</button><button class="btn" data-import>导入</button><input type="file" id="import-file" accept=".json,application/json" hidden>`}</div></header>
  <div class="card"><div class="hero"><div><div class="muted">今天 · ${esc(today)}</div><div class="big">${count} / ${list.length}</div><div class="muted">已完成今日事项</div></div><div style="font-size:25px">☀️</div></div><div class="progress"><div class="fill" style="width:${list.length?count/list.length*100:100}%"></div></div></div>
  ${popup?"":`<section class="section card"><div class="section-title" style="margin-top:0">${editing?"编辑任务":"添加一项任务"}</div>
  <form id="task-form" class="form">
  <label class="field wide">任务名称<input name="title" required maxlength="160" placeholder="例如：论坛每日签到"></label>
  <label class="field">类别<input name="category" maxlength="40" placeholder="网站签到、生活、学习"></label>
  <label class="field">重复<select name="repeat"><option value="daily">每天</option><option value="weekly">指定星期</option><option value="once">单次</option></select></label>
  <div class="field wide hidden" id="weekdays-wrap"><span>每周哪几天</span><div class="weekday-box">${[1,2,3,4,5,6,0].map(i=>`<label><input name="weekday" type="checkbox" value="${i}">${"日一二三四五六"[i]}</label>`).join("")}</div></div>
  <label class="field hidden" id="date-wrap">日期<input name="date" type="date"></label>
  <label class="field">时间<input name="time" type="time"></label>
  <label class="field wide">签到网址（可选）<input name="url" type="url" placeholder="https://example.com"></label>
  <label class="checklabel wide"><input type="checkbox" name="remind"> 在设定时间提醒我（需要保持浏览器运行）</label>
  <div class="actions"><button class="btn primary" type="submit">${editing?"保存修改":"添加任务"}</button>${editing?`<button type="button" class="btn" data-cancel>取消编辑</button>`:""}</div>
  </form></section>`}
  <section class="section card"><div class="header" style="margin-bottom:10px"><div class="section-title" style="margin:0">今日清单</div><div class="filters"><button class="btn small ${filter==="all"?"active":""}" data-filter="all">全部</button><button class="btn small ${filter==="pending"?"active":""}" data-filter="pending">未完成</button><button class="btn small ${filter==="done"?"active":""}" data-filter="done">已完成</button></div></div>
  ${shown.length?shown.map(line).join(""):`<div class="empty">${list.length?"这里没有符合条件的任务":"还没有任务，先添加一个吧。"}</div>`}
  </section>
  ${popup?"":`<div class="notice">所有数据仅保存在当前浏览器扩展内。每日重复任务按本地日期自动出现；请定期导出 JSON 备份。未打开浏览器时无法保证提醒。</div><div class="footer">无账户 · 无云端 · 无追踪 · 无 AI · 零月费</div>`}
  </main>`;
  bind();
  if(!popup){
    const f=$("#task-form");
    if(editing){
      const t=tasks.find(t=>t.id===editing);
      if(t){for(const k of ["title","category","repeat","date","time","url"]){if(f.elements[k])f.elements[k].value=t[k]||""}f.elements.remind.checked=!!t.remind;for(const el of f.querySelectorAll('[name="weekday"]'))el.checked=(t.weekdays||[]).includes(+el.value)}
    }
    setFields();
  }
}
function setFields(){
  const type=$("#task-form")?.elements.repeat.value;
  $("#weekdays-wrap")?.classList.toggle("hidden",type!=="weekly");
  $("#date-wrap")?.classList.toggle("hidden",type!=="once");
}
function bind(){
  document.querySelectorAll("[data-toggle]").forEach(el=>el.onchange=()=>toggle(el.dataset.toggle));
  document.querySelectorAll("[data-open]").forEach(el=>el.onclick=()=>{const t=tasks.find(x=>x.id===el.dataset.open);const u=urlSafe(t?.url);if(u)chrome.tabs.create({url:u})});
  document.querySelectorAll("[data-filter]").forEach(el=>el.onclick=()=>{filter=el.dataset.filter;render()});
  $("[data-manage]")?.addEventListener("click",()=>chrome.runtime.openOptionsPage());
  if(popup)return;
  $("[name=repeat]")?.addEventListener("change",setFields);
  document.querySelectorAll("[data-edit]").forEach(el=>el.onclick=()=>{editing=el.dataset.edit;render();$("#task-form").scrollIntoView({behavior:"smooth"})});
  document.querySelectorAll("[data-delete]").forEach(el=>el.onclick=async()=>{if(confirm("确定删除这项任务及其完成记录？")){tasks=tasks.filter(t=>t.id!==el.dataset.delete);if(editing===el.dataset.delete)editing=null;await save()}});
  $("[data-cancel]")?.addEventListener("click",()=>{editing=null;render()});
  $("#task-form").onsubmit=async e=>{
    e.preventDefault();const f=e.currentTarget;const x=new FormData(f);
    const title=String(x.get("title")||"").trim(),url=String(x.get("url")||"").trim(),repeat=x.get("repeat");
    if(!title)return;
    if(url&&!urlSafe(url)){alert("网址只能使用 http 或 https");return}
    const weekdays=x.getAll("weekday").map(Number);
    if(repeat==="weekly"&&!weekdays.length){alert("请至少选择一个星期");return}
    if(x.has("remind")&&!x.get("time")){alert("请为提醒设置时间");return}
    const original=tasks.find(t=>t.id===editing);
    const task={id:original?.id||uuid(),title,category:String(x.get("category")||"").trim(),repeat,weekdays:repeat==="weekly"?weekdays:[],date:repeat==="once"?String(x.get("date")||""): "",time:String(x.get("time")||""),url,remind:x.has("remind"),completed:original?.completed||[],createdAt:original?.createdAt||Date.now()};
    tasks=original?tasks.map(t=>t.id===original.id?task:t):[...tasks,task];
    editing=null;await save();
  };
  $("[data-export]")?.addEventListener("click",()=>{const blob=new Blob([JSON.stringify({version:1,tasks,exportedAt:new Date().toISOString()},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="dailydock-backup-"+today+".json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
  $("[data-import]")?.addEventListener("click",()=>$("#import-file").click());
  $("#import-file").onchange=async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>2000000){alert("备份文件不能超过 2MB");return}try{const obj=JSON.parse(await file.text());if(!Array.isArray(obj.tasks))throw Error("文件格式不正确");const incoming=obj.tasks.map(t=>({id:String(t.id||uuid()),title:String(t.title||"").slice(0,160),category:String(t.category||"").slice(0,40),repeat:["daily","weekly","once"].includes(t.repeat)?t.repeat:"once",weekdays:Array.isArray(t.weekdays)?t.weekdays.filter(n=>Number.isInteger(n)&&n>=0&&n<=6):[],date:String(t.date||""),time:/^([01]\d|2[0-3]):[0-5]\d$/.test(t.time||"")?t.time:"",url:urlSafe(t.url),remind:!!t.remind,completed:Array.isArray(t.completed)?t.completed.filter(s=>/^\d{4}-\d{2}-\d{2}$/.test(s)).slice(-400):[],createdAt:Number(t.createdAt)||Date.now()})).filter(t=>t.title);if(incoming.length>3000)throw Error("任务数量过多");if(confirm("导入将覆盖当前全部任务，建议先导出备份。是否继续？")){tasks=incoming;editing=null;await save()}}catch(err){alert("导入失败："+err.message)}};
}
chrome.storage.onChanged.addListener((changes,area)=>{if(area==="local"&&changes[KEY]){tasks=changes[KEY].newValue||[];render()}});
load();
