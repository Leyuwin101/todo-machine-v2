window.Notifications = (() => {
  const sent = new Set(JSON.parse(sessionStorage.getItem("todo_sent_notifications") || "[]"));
  const DEVICE_KEY = "todo_device_id";

  function saveSent() {
    sessionStorage.setItem("todo_sent_notifications", JSON.stringify([...sent].slice(-300)));
  }

  function permission() {
    return "Notification" in window ? Notification.permission : "unsupported";
  }

  function deviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
  }

  async function requestPermission() {
    if (!("Notification" in window)) return "unsupported";
    return Notification.requestPermission();
  }

  async function enablePush() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      throw new Error("WEB PUSH IS NOT SUPPORTED BY THIS BROWSER.");
    }
    if (!window.TODO_CONFIG?.vapidPublicKey || window.TODO_CONFIG.vapidPublicKey.startsWith("PASTE-")) {
      throw new Error("ADD YOUR VAPID PUBLIC KEY TO js/config.js FIRST.");
    }

    const p = await requestPermission();
    if (p !== "granted") return { status: p };

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(window.TODO_CONFIG.vapidPublicKey)
      });
    }

    await TodoDB.upsertPushSubscription(
      subscription.toJSON(),
      deviceId(),
      Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    );

    return { status: "subscribed", subscription };
  }

  async function disablePush() {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return false;
    await TodoDB.removePushSubscription(subscription.endpoint);
    await subscription.unsubscribe();
    return true;
  }

  function notify(task, minutesBefore) {
    const key = `${task.id}:${task.date}:${task.time}:${minutesBefore}`;
    if (sent.has(key)) return;
    sent.add(key); saveSent();

    const body = minutesBefore === 0
      ? `${task.title} is scheduled now.`
      : `${task.title} starts in ${minutesBefore} minute${minutesBefore === 1 ? "" : "s"}.`;

    if (Notification.permission === "granted") {
      try {
        const n = new Notification("📌 TODO REMINDER", {body, tag:`todo-${task.id}`});
        n.onclick = () => { window.focus(); window.dispatchEvent(new CustomEvent("task:open", {detail:{id:task.id}})); n.close(); };
      } catch {}
    }
    window.dispatchEvent(new CustomEvent("todo:toast", {detail:{title:"TODO REMINDER",body}}));
  }

  function check(tasks) {
    const now = Date.now();
    tasks.forEach(t => {
      if (!t.notification_enabled || t.completed || !t.date || !t.time) return;
      const dt = new Date(`${t.date}T${t.time}`).getTime();
      const reminderMs = Number(t.notification_time || 0) * 60000;
      const diff = dt - now;
      if (diff >= -30000 && diff <= reminderMs + 30000) notify(t, Number(t.notification_time || 0));
    });
  }

  function start(getTasks) {
    check(getTasks());
    setInterval(() => check(getTasks()), 15000);
  }

  return {permission,requestPermission,enablePush,disablePush,start,deviceId};
})();
