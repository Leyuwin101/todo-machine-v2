window.TaskStore = (() => {
  let tasks = [];
  let listener = null;

  const normalize = t => ({
    ...t,
    completed: Boolean(t.completed),
    notification_enabled: t.notification_enabled !== false,
    notification_time: Number(t.notification_time ?? 10)
  });

  function setTasks(next) { tasks = (next || []).map(normalize); listener?.(tasks); }
  function subscribe(fn) { listener = fn; fn(tasks); }
  function all() { return [...tasks]; }
  function byId(id) { return tasks.find(t => String(t.id) === String(id)); }

  function dateKey(d=new Date()) {
    const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), day=String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${day}`;
  }
  function taskDateTime(t) {
    if (!t.date) return null;
    const time = t.time || "23:59";
    const dt = new Date(`${t.date}T${time}`);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  function isToday(t) { return t.date === dateKey(); }
  function isOverdue(t) { const dt=taskDateTime(t); return !t.completed && dt && dt < new Date(); }
  function isUpcoming(t) { const dt=taskDateTime(t); return !t.completed && dt && dt >= new Date(); }

  function filter({view="today",search="",category=""}={}) {
    const q=search.trim().toLowerCase();
    return tasks.filter(t => {
      if (q && !`${t.title} ${t.description||""} ${t.category||""}`.toLowerCase().includes(q)) return false;
      if (category && t.category !== category) return false;
      if (view==="today" && !isToday(t)) return false;
      if (view==="upcoming" && !isUpcoming(t)) return false;
      if (view==="completed" && !t.completed) return false;
      if (view==="overdue" && !isOverdue(t)) return false;
      if (view==="high" && t.priority !== "high") return false;
      return true;
    });
  }

  function categories() { return [...new Set(tasks.map(t=>t.category).filter(Boolean))].sort(); }
  function next() {
    return tasks.filter(t=>!t.completed && taskDateTime(t)).sort((a,b)=>taskDateTime(a)-taskDateTime(b))[0] || null;
  }

  return {setTasks,subscribe,all,byId,dateKey,taskDateTime,isToday,isOverdue,isUpcoming,filter,categories,next};
})();
