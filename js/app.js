(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const state = {view:"dashboard", listView:"today", calendarDate:new Date(), editingId:null};

  const els = {
    boot:$("#bootScreen"),bootText:$("#bootText"),bootProgress:$("#bootProgress"),
    topClock:$("#topClock"),topDate:$("#topDate"),largeClock:$("#largeClock"),largeDate:$("#largeDate"),
    connectionDot:$("#connectionDot"),connectionText:$("#connectionText"),dbStatus:$("#dbStatus"),
    taskCountStatus:$("#taskCountStatus"),nextReminderStatus:$("#nextReminderStatus"),footerStatus:$("#footerStatus"),
    taskList:$("#taskList"),todayWidgetList:$("#todayWidgetList"),todayCount:$("#todayCount"),
    nextTaskContent:$("#nextTaskContent"),progressContent:$("#progressContent"),
    dialog:$("#taskDialog"),form:$("#taskForm"),dialogTitle:$("#dialogTitle"),formError:$("#formError"),
    taskId:$("#taskId"),taskTitle:$("#taskTitle"),taskDescription:$("#taskDescription"),taskDate:$("#taskDate"),taskTime:$("#taskTime"),
    taskPriority:$("#taskPriority"),taskCategory:$("#taskCategory"),notificationEnabled:$("#notificationEnabled"),notificationTime:$("#notificationTime"),
    listTaskList:$("#listTaskList"),listSearch:$("#listSearch"),taskSearch:$("#taskSearch"),quickFilter:$("#quickFilter"),
    categoryFilter:$("#categoryFilter"),categoryOptions:$("#categoryOptions"),calendarGrid:$("#calendarGrid"),calendarTitle:$("#calendarTitle")
  };

  function escapeHTML(value=""){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
  function formatTime(t){if(!t)return "NO TIME";const [h,m]=t.split(":").map(Number);const d=new Date();d.setHours(h,m,0,0);return d.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});}
  function formatDate(date){return new Intl.DateTimeFormat(undefined,{weekday:"long",month:"2-digit",day:"2-digit",year:"numeric"}).format(date).toUpperCase();}
  function dateLabel(s){if(!s)return "";const d=new Date(`${s}T00:00:00`);return d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}).toUpperCase();}
  function countdown(dt){let ms=dt-Date.now();if(ms<0)return "PAST DUE";const d=Math.floor(ms/86400000);ms%=86400000;const h=Math.floor(ms/3600000);ms%=3600000;const m=Math.floor(ms/60000);return `${d?d+"D ":""}${String(h).padStart(2,"0")}H ${String(m).padStart(2,"0")}M`;}

  function toast(title,body){
    const node=document.createElement("div");node.className="toast";node.innerHTML=`<strong>${escapeHTML(title)}</strong><div>${escapeHTML(body)}</div>`;
    $("#toastRegion").appendChild(node);setTimeout(()=>node.remove(),5000);
  }

  function setConnection(ok){
    els.connectionDot.classList.toggle("offline",!ok);
    els.connectionText.textContent=ok?"DATABASE ONLINE":"OFFLINE / DISCONNECTED";
    els.dbStatus.textContent=`DATABASE: ${ok?"CONNECTED":"OFFLINE"}`;
    els.footerStatus.textContent=ok?"TASK DATABASE CONNECTED":"OFFLINE — SYNC PENDING";
    $("#offlineBanner").classList.toggle("hidden",ok);
  }

  async function refresh(){
    try{
      const data=await TodoDB.listTasks();
      TaskStore.setTasks(data);
      setConnection(true);
    }catch(e){
      setConnection(false);
      if(!TodoDB.configured()) toast("CONFIG REQUIRED","Copy js/config.example.js to js/config.js and add your Supabase values.");
      else toast("DATABASE ERROR",e.message);
    }
  }

  async function saveTask(payload,id){
    if(id) await TodoDB.updateTask(id,payload); else await TodoDB.createTask(payload);
    await refresh();
    toast("SYSTEM READY",id?"TASK UPDATED":"TASK SAVED TO DATABASE");
  }
  async function deleteTask(id){
    if(!confirm("DELETE THIS TASK?"))return;
    try{await TodoDB.deleteTask(id);await refresh();toast("TASK REMOVED","Database record deleted.");}
    catch(e){toast("DELETE ERROR",e.message);}
  }
  async function toggleTask(id){
    const t=TaskStore.byId(id);if(!t)return;
    try{await TodoDB.updateTask(id,{completed:!t.completed,updated_at:new Date().toISOString()});await refresh();}
    catch(e){toast("UPDATE ERROR",e.message);}
  }

  function renderAll(tasks){
    renderDashboard(tasks);renderCurrentList();renderCalendar();renderCategories();
    els.taskCountStatus.textContent=`TASKS: ${tasks.length}`;
    const next=TaskStore.next();els.nextReminderStatus.textContent=`NEXT REMINDER: ${next?formatTime(next.time):"NONE"}`;
  }

  function renderDashboard(tasks){
    const today=tasks.filter(TaskStore.isToday);
    const visible=TaskStore.filter({view:els.quickFilter.value,search:els.taskSearch.value});
    els.todayCount.textContent=`${today.length} TASK${today.length===1?"":"S"}`;
    els.taskList.innerHTML=taskRows(visible);
    els.todayWidgetList.innerHTML=today.length?today.slice(0,5).map(t=>`<div class="mini-task"><span>${t.completed?"■":"□"}</span><span class="${t.completed?"done":""}">${escapeHTML(t.title)}</span><span>${formatTime(t.time)}</span></div>`).join(""):`<div class="empty-state">NO TASKS FOR TODAY.</div>`;

    const done=today.filter(t=>t.completed).length, pct=today.length?Math.round(done/today.length*100):0;
    els.progressContent.innerHTML=`<div class="progress-wrap"><div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div><div class="progress-text">${done} / ${today.length} COMPLETE — ${pct}%</div></div>`;

    const next=TaskStore.next();
    els.nextTaskContent.innerHTML=next?`<div class="widget-content"><div class="next-task-title">${escapeHTML(next.title)}</div><div class="next-task-time">${dateLabel(next.date)} · ${formatTime(next.time)}</div><div class="countdown">STARTS IN ${countdown(TaskStore.taskDateTime(next))}</div></div>`:`<div class="widget-content empty-state">NO UPCOMING TASKS.</div>`;
  }

  function taskRows(tasks){
    if(!tasks.length)return `<div class="empty-state">NO TASKS FOUND.<br>CREATE A NEW TASK TO BEGIN.</div>`;
    return tasks.map(t=>{
      const overdue=TaskStore.isOverdue(t);
      return `<article class="task-row" data-id="${escapeHTML(t.id)}">
        <input class="task-check" type="checkbox" ${t.completed?"checked":""} aria-label="Complete ${escapeHTML(t.title)}">
        <div class="task-main"><div class="task-title ${t.completed?"completed":""}">${escapeHTML(t.title)}</div><div class="task-meta">${escapeHTML(t.category||"GENERAL")} · ${dateLabel(t.date)}${t.notification_enabled?" · 🔔 REMINDER":""}${overdue?" · OVERDUE":""}</div></div>
        <div class="priority ${t.priority}">${t.priority==="high"?"!!!":t.priority==="medium"?"!!":"!"}</div>
        <div class="task-time">${formatTime(t.time)}</div>
        <div class="task-actions"><button class="icon-button edit-task" title="Edit task">EDIT</button><button class="icon-button delete-task" title="Delete task">DEL</button></div>
      </article>`;
    }).join("");
  }

  function bindTaskList(container){
    container.addEventListener("click",e=>{
      const row=e.target.closest(".task-row");if(!row)return;const id=row.dataset.id;
      if(e.target.closest(".edit-task"))openDialog(TaskStore.byId(id));
      if(e.target.closest(".delete-task"))deleteTask(id);
    });
    container.addEventListener("change",e=>{
      const row=e.target.closest(".task-row");if(row&&e.target.classList.contains("task-check"))toggleTask(row.dataset.id);
    });
  }

  function renderCurrentList(){
    const view=state.listView;
    const map={today:["03 / TASKS","TODAY"],upcoming:["04 / TASKS","UPCOMING"],completed:["05 / TASKS","COMPLETED"],overdue:["06 / TASKS","OVERDUE"],high:["07 / TASKS","HIGH PRIORITY"],categories:["08 / TASKS","CATEGORIES"]};
    $("#listEyebrow").textContent=map[view]?.[0]||"03 / TASKS";$("#listTitle").textContent=map[view]?.[1]||"TASKS";
    let list=TaskStore.filter({view:view==="categories"?"all":view,search:els.listSearch.value,category:els.categoryFilter.value});
    els.listTaskList.innerHTML=taskRows(list);
  }

  function renderCategories(){
    const cats=TaskStore.categories();
    els.categoryFilter.innerHTML=`<option value="">ALL CATEGORIES</option>`+cats.map(c=>`<option>${escapeHTML(c)}</option>`).join("");
    els.categoryOptions.innerHTML=cats.map(c=>`<option value="${escapeHTML(c)}"></option>`).join("");
  }

  function renderCalendar(){
    const d=state.calendarDate,y=d.getFullYear(),m=d.getMonth();
    els.calendarTitle.textContent=d.toLocaleDateString(undefined,{month:"long",year:"numeric"}).toUpperCase();
    const first=new Date(y,m,1),last=new Date(y,m+1,0),start=first.getDay(),cells=Math.ceil((start+last.getDate())/7)*7;
    const tasks=TaskStore.all();let html="";
    for(let i=0;i<cells;i++){
      const day=i-start+1, cellDate=new Date(y,m,day), inMonth=cellDate.getMonth()===m;
      const key=TaskStore.dateKey(cellDate), dayTasks=tasks.filter(t=>t.date===key);
      html+=`<div class="calendar-cell ${inMonth?"":"other"} ${key===TaskStore.dateKey()?"today":""}">
        <div class="calendar-day">${cellDate.getDate()}</div>
        ${dayTasks.slice(0,3).map(t=>`<div class="calendar-task ${t.priority}">${t.completed?"■":"□"} ${escapeHTML(t.title)}</div>`).join("")}
        ${dayTasks.length>3?`<div class="calendar-more">+${dayTasks.length-3} MORE</div>`:""}
      </div>`;
    }
    els.calendarGrid.innerHTML=html;
  }

  function openDialog(task=null){
    state.editingId=task?.id||null;els.form.reset();els.formError.textContent="";
    els.dialogTitle.textContent=task?"EDIT TASK":"NEW TASK";
    els.taskId.value=task?.id||"";
    els.taskTitle.value=task?.title||"";els.taskDescription.value=task?.description||"";
    els.taskDate.value=task?.date||TaskStore.dateKey();els.taskTime.value=task?.time||"";
    els.taskPriority.value=task?.priority||"medium";els.taskCategory.value=task?.category||"";
    els.notificationEnabled.checked=task?.notification_enabled ?? true;els.notificationTime.value=String(task?.notification_time ?? 10);
    els.dialog.showModal();els.taskTitle.focus();
  }
  function closeDialog(){els.dialog.close();state.editingId=null;}

  async function handleSubmit(e){
    e.preventDefault();els.formError.textContent="";
    const title=els.taskTitle.value.trim(),date=els.taskDate.value;
    if(!title||!date){els.formError.textContent="TASK TITLE AND DATE ARE REQUIRED.";return}
    const time=els.taskTime.value||null;
    const notificationMinutes=Number(els.notificationTime.value);
    const notificationAt = els.notificationEnabled.checked && time
      ? new Date(new Date(`${date}T${time}:00`).getTime() - notificationMinutes * 60000).toISOString()
      : null;
    const payload={title,description:els.taskDescription.value.trim(),date,time,priority:els.taskPriority.value,category:els.taskCategory.value.trim()||"General",completed:false,notification_enabled:els.notificationEnabled.checked,notification_time:notificationMinutes,notification_at:notificationAt,updated_at:new Date().toISOString()};
    if(state.editingId){const old=TaskStore.byId(state.editingId);payload.completed=old.completed;payload.created_at=old.created_at}
    try{await saveTask(payload,state.editingId);closeDialog();}catch(e){els.formError.textContent=e.message}
  }

  function switchView(view){
    state.view=view;
    $$(".nav-button").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
    $$(".view").forEach(v=>v.classList.remove("active"));
    if(view==="dashboard")$("#dashboardView").classList.add("active");
    else if(view==="calendar")$("#calendarView").classList.add("active");
    else {state.listView=view;$("#listView").classList.add("active");renderCurrentList();}
  }

  function updateClock(){
    const d=new Date(),time=d.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}),date=formatDate(d);
    els.topClock.textContent=time;els.topDate.textContent=d.toLocaleDateString();
    els.largeClock.textContent=time;els.largeDate.textContent=date;
    if(state.view==="dashboard"){const next=TaskStore.next();if(next)els.nextTaskContent.querySelector(".countdown")?.replaceChildren(document.createTextNode(`STARTS IN ${countdown(TaskStore.taskDateTime(next))}`));}
  }

  function boot(){
    const lines=["BOOTING TODO MACHINE...","LOADING TASK DATABASE...","INITIALIZING CLOCK...","CHECKING NOTIFICATIONS...","SYSTEM READY."];
    let i=0;
    const timer=setInterval(()=>{els.bootText.textContent=lines[i]||lines.at(-1);els.bootProgress.style.width=`${Math.min(100,(i+1)*20)}%`;i++;if(i>lines.length){clearInterval(timer);setTimeout(()=>els.boot.remove(),250)}},220);
    $("#skipBoot").onclick=()=>{clearInterval(timer);els.boot.remove()};
  }

  function setup(){
    boot();updateClock();setInterval(updateClock,1000);
    TaskStore.subscribe(renderAll);
    bindTaskList(els.taskList);bindTaskList(els.listTaskList);

    $$(".nav-button").forEach(b=>b.onclick=()=>switchView(b.dataset.view));
    $("#newTaskButton").onclick=()=>openDialog();$("#newTaskButtonSide").onclick=()=>openDialog();$("#newTaskButtonList").onclick=()=>openDialog();
    $("#closeDialog").onclick=closeDialog;$("#cancelDialog").onclick=closeDialog;els.form.addEventListener("submit",handleSubmit);
    els.taskSearch.oninput=()=>renderDashboard(TaskStore.all());els.quickFilter.onchange=()=>renderDashboard(TaskStore.all());
    els.listSearch.oninput=renderCurrentList;els.categoryFilter.onchange=renderCurrentList;
    $("#prevMonth").onclick=()=>{state.calendarDate.setMonth(state.calendarDate.getMonth()-1);renderCalendar()};
    $("#nextMonth").onclick=()=>{state.calendarDate.setMonth(state.calendarDate.getMonth()+1);renderCalendar()};
    $("#notifyButton").onclick=async()=>{
      try{
        const result=await Notifications.enablePush();
        if(result.status==="subscribed") toast("PUSH ENABLED","Server reminders are now registered for this device.");
        else toast("NOTIFICATIONS",`Permission: ${result.status}`);
      }catch(e){toast("PUSH SETUP ERROR",e.message)}
    };
    window.addEventListener("db:status",e=>setConnection(e.detail.connected));
    window.addEventListener("todo:toast",e=>toast(e.detail.title,e.detail.body));
    window.addEventListener("task:open",e=>openDialog(TaskStore.byId(e.detail.id)));
    window.addEventListener("online",refresh);window.addEventListener("offline",()=>setConnection(false));

    if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});
    TodoDB.connectRealtime(()=>refresh());
    refresh();
    Notifications.start(()=>TaskStore.all());
  }
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",setup):setup();
})();
