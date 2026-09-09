/* TODO MACHINE DATABASE ADAPTER
   Uses Supabase REST + Realtime directly with fetch/WebSocket.
   Put your project values in js/config.js (copy config.example.js).
*/
window.TodoDB = (() => {
  const config = window.TODO_CONFIG || {};
  let socket = null;
  let heartbeat = null;
  let reconnectTimer = null;
  let subscriptionCallback = null;
  let connected = false;

  function headers() {
    return {
      "apikey": config.anonKey || "",
      "Authorization": `Bearer ${config.anonKey || ""}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    };
  }
  function configured() {
    return Boolean(config.supabaseUrl && config.anonKey);
  }
  function endpoint(path) {
    return `${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`;
  }

  async function request(path, options={}) {
    if (!configured()) throw new Error("Supabase is not configured. Copy config.example.js to js/config.js.");
    const res = await fetch(endpoint(path), { ...options, headers: {...headers(), ...(options.headers || {})} });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status}: ${text || res.statusText}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  async function listTasks() {
    return request("tasks?select=*&order=date.asc,time.asc,created_at.asc");
  }

  async function createTask(task) {
    return request("tasks", {method:"POST", body:JSON.stringify(task)});
  }

  async function updateTask(id, task) {
    return request(`tasks?id=eq.${encodeURIComponent(id)}`, {method:"PATCH", body:JSON.stringify(task)});
  }

  async function deleteTask(id) {
    await request(`tasks?id=eq.${encodeURIComponent(id)}`, {method:"DELETE"});
    return true;
  }

  function connectRealtime(onChange) {
    subscriptionCallback = onChange;
    if (!configured()) return;
    if (socket && socket.readyState === WebSocket.OPEN) return;

    const projectRef = new URL(config.supabaseUrl).hostname.split(".")[0];
    const wsUrl = `${config.supabaseUrl.replace(/^https?/, "wss")}/realtime/v1/websocket?apikey=${encodeURIComponent(config.anonKey)}&vsn=1.0.0`;
    try {
      socket = new WebSocket(wsUrl);
      socket.onopen = () => {
        connected = true;
        window.dispatchEvent(new CustomEvent("db:status", {detail:{connected:true}}));
        const join = {
          topic:`realtime:public:tasks`,
          event:"phx_join",
          payload:{config:{broadcast:{self:false},presence:{key:""}},access_token:config.anonKey},
          ref:"1"
        };
        socket.send(JSON.stringify(join));
        heartbeat = setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({topic:"phoenix",event:"heartbeat",payload:{},ref:String(Date.now())}));
          }
        }, 25000);
      };
      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.event === "postgres_changes" || msg.event === "INSERT" || msg.event === "UPDATE" || msg.event === "DELETE") {
            subscriptionCallback?.(msg);
          }
        } catch {}
      };
      socket.onclose = () => {
        connected = false;
        clearInterval(heartbeat);
        window.dispatchEvent(new CustomEvent("db:status", {detail:{connected:false}}));
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => connectRealtime(onChange), 4000);
      };
      socket.onerror = () => {
        connected = false;
        window.dispatchEvent(new CustomEvent("db:status", {detail:{connected:false}}));
      };
    } catch {
      connected = false;
      window.dispatchEvent(new CustomEvent("db:status", {detail:{connected:false}}));
    }
  }

  async function upsertPushSubscription(subscription, deviceId, timezone) {
    const payload = {
      device_id: deviceId,
      endpoint: subscription.endpoint,
      subscription,
      timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      user_agent: navigator.userAgent.slice(0, 500),
      updated_at: new Date().toISOString()
    };
    return request("push_subscriptions?on_conflict=endpoint", {
      method: "POST",
      headers: {
        "Prefer": "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify(payload)
    });
  }

  async function removePushSubscription(endpointValue) {
    await request(`push_subscriptions?endpoint=eq.${encodeURIComponent(endpointValue)}`, { method: "DELETE" });
    return true;
  }

  async function testConnection() {
    if (!configured()) return false;
    await request("tasks?select=id&limit=1");
    return true;
  }

  return {configured,listTasks,createTask,updateTask,deleteTask,connectRealtime,upsertPushSubscription,removePushSubscription,testConnection};
})();
