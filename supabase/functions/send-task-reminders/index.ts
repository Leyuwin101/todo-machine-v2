import { createClient } from "npm:@supabase/supabase-js@2";
import { sendPushNotification, WebPushError } from "npm:@mmmike/web-push@1.0.1/send";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SECRET_KEYS = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const SUPABASE_SECRET_KEY = SECRET_KEYS.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const CRON_SECRET = Deno.env.get("TODO_CRON_SECRET")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:todo-machine@example.com";

const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY!);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {status, headers:{"Content-Type":"application/json"}});
}

function authorized(req: Request) {
  return req.headers.get("x-cron-secret") === CRON_SECRET;
}

async function sendToSubscription(subscription: any, task: any) {
  return sendPushNotification(
    subscription,
    {
      title: "📌 TODO REMINDER",
      body: task.notification_time === 0
        ? `${task.title} is scheduled now.`
        : `${task.title} starts in ${task.notification_time} minute${task.notification_time === 1 ? "" : "s"}.`,
      url: "/",
      tag: `todo-${task.id}`
    },
    {subject: VAPID_SUBJECT, publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY},
    {ttl: 86400, urgency: "high"}
  );
}

async function processDueTasks() {
  const now = new Date();
  const lower = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  const upper = new Date(now.getTime() + 60 * 1000).toISOString();

  const {data: tasks, error: taskError} = await admin
    .from("tasks")
    .select("id,title,notification_time,notification_at")
    .eq("notification_enabled", true)
    .eq("completed", false)
    .not("notification_at", "is", null)
    .gte("notification_at", lower)
    .lt("notification_at", upper);

  if (taskError) throw taskError;
  if (!tasks?.length) return {tasks:0, sent:0, removed:0, failed:0};

  const {data: subscriptions, error: subscriptionError} = await admin
    .from("push_subscriptions")
    .select("id,endpoint,subscription");

  if (subscriptionError) throw subscriptionError;
  if (!subscriptions?.length) return {tasks:tasks.length, sent:0, removed:0, failed:0};

  let sent = 0, removed = 0, failed = 0;

  for (const task of tasks) {
    for (const sub of subscriptions) {
      const {data: delivery, error: deliveryError} = await admin
        .from("notification_deliveries")
        .insert({task_id:task.id, subscription_id:sub.id})
        .select("id")
        .maybeSingle();

      if (deliveryError?.code === "23505") continue;
      if (deliveryError) { failed++; continue; }

      try {
        const result = await sendToSubscription(sub.subscription, task);
        if (result === false) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
          await admin.from("notification_deliveries").delete().eq("id", delivery.id);
          removed++;
          continue;
        }
        await admin.from("notification_deliveries").update({sent_at:new Date().toISOString()}).eq("id", delivery.id);
        sent++;
      } catch (error) {
        await admin.from("notification_deliveries").delete().eq("id", delivery.id);
        if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
          removed++;
        } else {
          failed++;
          console.error("push send failed", error instanceof Error ? error.message : String(error));
        }
      }
    }
  }

  return {tasks:tasks.length, sent, removed, failed};
}

Deno.serve(async (req) => {
  if (!authorized(req)) return json({error:"Unauthorized"}, 401);
  try {
    const result = await processDueTasks();
    return json({ok:true, ...result});
  } catch (error) {
    console.error(error);
    return json({ok:false, error:error instanceof Error ? error.message : String(error)}, 500);
  }
});
