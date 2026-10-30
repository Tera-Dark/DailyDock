const KEY = "dailydock.tasks";
const dayKey = (d = new Date()) => [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-");
const dueToday = (task, d = new Date()) => task.repeat === "daily" || (task.repeat === "weekly" && task.weekdays?.includes(d.getDay())) || (task.repeat === "once" && task.date === dayKey(d));
const isDone = (task, d = new Date()) => task.completed?.includes(task.repeat==="once"?"__once__":dayKey(d)) ?? false;
async function schedule() {
  await chrome.alarms.clearAll();
  const { [KEY]: tasks = [] } = await chrome.storage.local.get(KEY);
  const now = new Date();
  const midnight = new Date(now); midnight.setHours(24,0,5,0);
  await chrome.alarms.create("refresh", {when:midnight.getTime()});
  for (const task of tasks) {
    if (!task.remind || !task.time || !dueToday(task) || isDone(task)) continue;
    const [hh,mm] = task.time.split(":").map(Number);
    const at = new Date(); at.setHours(hh,mm,0,0);
    if (at.getTime()>Date.now()) await chrome.alarms.create("task:"+task.id,{when:at.getTime()});
  }
}
async function remind(id) {
  const { [KEY]:tasks=[] } = await chrome.storage.local.get(KEY);
  const task = tasks.find(t=>t.id===id);
  if (!task || !dueToday(task) || isDone(task)) return;
  await chrome.notifications.create("dd:"+id,{
    type:"basic",iconUrl:"icon.svg",title:"DailyDock · 待办提醒",
    message:task.title+(task.url?" · 点击可打开任务管理页":""),
    priority:1
  });
}
chrome.runtime.onInstalled.addListener(()=>{schedule();});
chrome.runtime.onStartup.addListener(()=>{schedule();});
chrome.storage.onChanged.addListener((changes,area)=>{if(area==="local" && changes[KEY]) schedule();});
chrome.alarms.onAlarm.addListener(async alarm=>{if(alarm.name==="refresh"){await schedule();return;}if(alarm.name.startsWith("task:")) await remind(alarm.name.slice(5));});
chrome.notifications.onClicked.addListener(id=>{if(id.startsWith("dd:")) chrome.runtime.openOptionsPage();});
