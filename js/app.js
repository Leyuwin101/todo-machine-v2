/* =========================================================
   TODO MACHINE
   MAIN APPLICATION
   ========================================================= */

(() => {
  "use strict";

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];

  const state = {
    view: "dashboard",
    listView: "today",
    calendarDate: new Date(),
    editingId: null
  };

  const els = {
    boot: $("#bootScreen"),
    bootText: $("#bootText"),
    bootProgress: $("#bootProgress"),

    topClock: $("#topClock"),
    topDate: $("#topDate"),
    largeClock: $("#largeClock"),
    largeDate: $("#largeDate"),

    connectionDot: $("#connectionDot"),
    connectionText: $("#connectionText"),
    dbStatus: $("#dbStatus"),
    taskCountStatus: $("#taskCountStatus"),
    nextReminderStatus: $("#nextReminderStatus"),
    footerStatus: $("#footerStatus"),

    taskList: $("#taskList"),
    todayWidgetList: $("#todayWidgetList"),
    todayCount: $("#todayCount"),
    nextTaskContent: $("#nextTaskContent"),
    progressContent: $("#progressContent"),

    dialog: $("#taskDialog"),
    form: $("#taskForm"),
    dialogTitle: $("#dialogTitle"),
    formError: $("#formError"),

    taskId: $("#taskId"),
    taskTitle: $("#taskTitle"),
    taskDescription: $("#taskDescription"),
    taskDate: $("#taskDate"),
    taskTime: $("#taskTime"),
    taskPriority: $("#taskPriority"),
    taskCategory: $("#taskCategory"),
    notificationEnabled: $("#notificationEnabled"),
    notificationTime: $("#notificationTime"),

    listTaskList: $("#listTaskList"),
    listSearch: $("#listSearch"),
    taskSearch: $("#taskSearch"),
    quickFilter: $("#quickFilter"),
    categoryFilter: $("#categoryFilter"),
    categoryOptions: $("#categoryOptions"),

    calendarGrid: $("#calendarGrid"),
    calendarTitle: $("#calendarTitle")
  };

  /* =======================================================
     HELPERS
     ======================================================= */

  function escapeHTML(value = "") {
    return String(value).replace(
      /[&<>"']/g,
      character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[character]
    );
  }

  function formatTime(time) {
    if (!time) return "NO TIME";

    const [hours, minutes] =
      time.split(":").map(Number);

    const date = new Date();

    date.setHours(
      hours || 0,
      minutes || 0,
      0,
      0
    );

    return date.toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    );
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat(
      undefined,
      {
        weekday: "long",
        month: "2-digit",
        day: "2-digit",
        year: "numeric"
      }
    )
      .format(date)
      .toUpperCase();
  }

  function dateLabel(value) {
    if (!value) return "";

    const date =
      new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date
      .toLocaleDateString(
        undefined,
        {
          month: "short",
          day: "numeric",
          year: "numeric"
        }
      )
      .toUpperCase();
  }

  function countdown(dateTime) {
    if (!dateTime) return "NO DATE";

    let milliseconds =
      new Date(dateTime).getTime() -
      Date.now();

    if (milliseconds <= 0) {
      return "PAST DUE";
    }

    const days =
      Math.floor(
        milliseconds / 86400000
      );

    milliseconds %= 86400000;

    const hours =
      Math.floor(
        milliseconds / 3600000
      );

    milliseconds %= 3600000;

    const minutes =
      Math.floor(
        milliseconds / 60000
      );

    return (
      `${days ? `${days}D ` : ""}` +
      `${String(hours).padStart(2, "0")}H ` +
      `${String(minutes).padStart(2, "0")}M`
    );
  }

  /* =======================================================
     TOAST
     ======================================================= */

  function toast(title, body) {
    const region =
      $("#toastRegion");

    if (!region) return;

    const node =
      document.createElement("div");

    node.className = "toast";

    node.innerHTML = `
      <strong>${escapeHTML(title)}</strong>
      <div>${escapeHTML(body)}</div>
    `;

    region.appendChild(node);

    setTimeout(
      () => node.remove(),
      5000
    );
  }

  window.addEventListener(
    "todo:toast",
    event => {
      const detail =
        event.detail || {};

      toast(
        detail.title || "TODO MACHINE",
        detail.body || ""
      );
    }
  );

  /* =======================================================
     CONNECTION
     ======================================================= */

  function setConnection(online) {
    els.connectionDot?.classList.toggle(
      "offline",
      !online
    );

    if (els.connectionText) {
      els.connectionText.textContent =
        online
          ? "DATABASE ONLINE"
          : "OFFLINE / DISCONNECTED";
    }

    if (els.dbStatus) {
      els.dbStatus.textContent =
        `DATABASE: ${
          online
            ? "CONNECTED"
            : "OFFLINE"
        }`;
    }

    if (els.footerStatus) {
      els.footerStatus.textContent =
        online
          ? "TASK DATABASE CONNECTED"
          : "OFFLINE — SYNC PENDING";
    }

    $("#offlineBanner")
      ?.classList.toggle(
        "hidden",
        online
      );
  }

  /* =======================================================
     DATABASE REFRESH
     ======================================================= */

  async function refresh() {
    try {
      const tasks =
        await TodoDB.listTasks();

      TaskStore.setTasks(
        Array.isArray(tasks)
          ? tasks
          : []
      );

      setConnection(true);

      renderAll(
        TaskStore.all()
      );

    } catch (error) {
      console.error(
        "[APP] Database refresh failed:",
        error
      );

      setConnection(false);

      if (
        typeof TodoDB?.configured ===
          "function" &&
        !TodoDB.configured()
      ) {
        toast(
          "CONFIG REQUIRED",
          "Check js/config.js for your Supabase settings."
        );
      } else {
        toast(
          "DATABASE ERROR",
          error.message ||
            "Unable to load tasks."
        );
      }

      renderAll(
        TaskStore.all()
      );
    }
  }

  /* =======================================================
     TASK ACTIONS
     ======================================================= */

  async function saveTask(payload, id) {
    try {
      if (id) {
        await TodoDB.updateTask(
          id,
          payload
        );
      } else {
        await TodoDB.createTask(
          payload
        );
      }

      await refresh();

      toast(
        "SYSTEM READY",
        id
          ? "TASK UPDATED"
          : "TASK SAVED TO DATABASE"
      );

      closeDialog();

    } catch (error) {
      console.error(
        "[APP] Save failed:",
        error
      );

      if (els.formError) {
        els.formError.textContent =
          error.message ||
          "Unable to save task.";
      }

      toast(
        "SAVE ERROR",
        error.message ||
          "Unable to save task."
      );
    }
  }

  async function deleteTask(id) {
    if (!id) return;

    if (
      !confirm(
        "DELETE THIS TASK?"
      )
    ) {
      return;
    }

    try {
      await TodoDB.deleteTask(id);

      await refresh();

      toast(
        "TASK REMOVED",
        "Database record deleted."
      );

    } catch (error) {
      toast(
        "DELETE ERROR",
        error.message ||
          "Unable to delete task."
      );
    }
  }

  async function toggleTask(id) {
    const task =
      TaskStore.byId(id);

    if (!task) return;

    try {
      await TodoDB.updateTask(
        id,
        {
          completed:
            !task.completed,

          updated_at:
            new Date().toISOString()
        }
      );

      await refresh();

    } catch (error) {
      toast(
        "UPDATE ERROR",
        error.message ||
          "Unable to update task."
      );
    }
  }

  /* =======================================================
     RENDER ALL
     ======================================================= */

  function renderAll(tasks) {
    renderDashboard(tasks);
    renderCurrentList();
    renderCalendar();
    renderCategories();

    if (els.taskCountStatus) {
      els.taskCountStatus.textContent =
        `TASKS: ${tasks.length}`;
    }

    const next =
      TaskStore.next();

    if (els.nextReminderStatus) {
      els.nextReminderStatus.textContent =
        `NEXT REMINDER: ${
          next
            ? formatTime(next.time)
            : "NONE"
        }`;
    }
  }

  /* =======================================================
     DASHBOARD
     ======================================================= */

  function renderDashboard(tasks) {
    const today =
      tasks.filter(
        TaskStore.isToday
      );

    const visible =
      TaskStore.filter({
        view:
          els.quickFilter?.value ||
          "all",

        search:
          els.taskSearch?.value ||
          ""
      });

    if (els.todayCount) {
      els.todayCount.textContent =
        `${today.length} TASK${
          today.length === 1
            ? ""
            : "S"
        }`;
    }

    if (els.taskList) {
      els.taskList.innerHTML =
        taskRows(visible);
    }

    if (els.todayWidgetList) {
      els.todayWidgetList.innerHTML =
        today.length
          ? today
              .slice(0, 5)
              .map(
                task => `
                  <div class="mini-task">
                    <span>
                      ${task.completed
                        ? "■"
                        : "□"}
                    </span>

                    <span class="${
                      task.completed
                        ? "done"
                        : ""
                    }">
                      ${escapeHTML(
                        task.title
                      )}
                    </span>

                    <span>
                      ${formatTime(
                        task.time
                      )}
                    </span>
                  </div>
                `
              )
              .join("")
          : `
              <div class="empty-state">
                NO TASKS FOR TODAY.
              </div>
            `;
    }

    const completed =
      today.filter(
        task => task.completed
      ).length;

    const percent =
      today.length
        ? Math.round(
            completed /
              today.length *
              100
          )
        : 0;

    if (els.progressContent) {
      els.progressContent.innerHTML = `
        <div class="progress-wrap">
          <div class="progress-bar">
            <div
              class="progress-fill"
              style="width:${percent}%"
            ></div>
          </div>

          <div class="progress-text">
            ${completed} / ${today.length}
            COMPLETE — ${percent}%
          </div>
        </div>
      `;
    }

    const next =
      TaskStore.next();

    if (els.nextTaskContent) {
      els.nextTaskContent.innerHTML =
        next
          ? `
            <div class="widget-content">
              <div class="next-task-title">
                ${escapeHTML(
                  next.title
                )}
              </div>

              <div class="next-task-time">
                ${dateLabel(next.date)}
                ·
                ${formatTime(next.time)}
              </div>

              <div class="countdown">
                STARTS IN
                ${countdown(
                  TaskStore.taskDateTime(
                    next
                  )
                )}
              </div>
            </div>
          `
          : `
            <div class="widget-content empty-state">
              NO UPCOMING TASKS.
            </div>
          `;
    }
  }

  /* =======================================================
     TASK ROWS
     ======================================================= */

  function taskRows(tasks) {
    if (!tasks.length) {
      return `
        <div class="empty-state">
          NO TASKS FOUND.
          <br>
          CREATE A NEW TASK TO BEGIN.
        </div>
      `;
    }

    return tasks
      .map(task => {
        const overdue =
          TaskStore.isOverdue(task);

        const priority =
          ["low", "medium", "high"]
            .includes(task.priority)
            ? task.priority
            : "medium";

        return `
          <article
            class="task-row"
            data-id="${escapeHTML(
              task.id
            )}"
          >

            <input
              class="task-check"
              type="checkbox"
              ${
                task.completed
                  ? "checked"
                  : ""
              }
              aria-label="Complete ${escapeHTML(
                task.title
              )}"
            >

            <div class="task-main">
              <div class="task-title ${
                task.completed
                  ? "completed"
                  : ""
              }">
                ${escapeHTML(
                  task.title
                )}
              </div>

              <div class="task-meta">
                ${escapeHTML(
                  task.category ||
                    "GENERAL"
                )}
                ·
                ${dateLabel(task.date)}

                ${
                  task.notification_enabled
                    ? " · 🔔 REMINDER"
                    : ""
                }

                ${
                  overdue
                    ? " · OVERDUE"
                    : ""
                }
              </div>
            </div>

            <div
              class="priority ${priority}"
              aria-label="${priority} priority"
            >
              ${
                priority === "high"
                  ? "!!!"
                  : priority === "medium"
                    ? "!!"
                    : "!"
              }
            </div>

            <div class="task-time">
              ${formatTime(
                task.time
              )}
            </div>

            <div class="task-actions">
              <button
                class="icon-button edit-task"
                type="button"
                title="Edit task"
              >
                EDIT
              </button>

              <button
                class="icon-button delete-task"
                type="button"
                title="Delete task"
              >
                DEL
              </button>
            </div>

          </article>
        `;
      })
      .join("");
  }

  /* =======================================================
     TASK LIST EVENTS
     ======================================================= */

  function bindTaskList(container) {
    if (!container) return;

    container.addEventListener(
      "click",
      event => {
        const row =
          event.target.closest(
            ".task-row"
          );

        if (!row) return;

        const id =
          row.dataset.id;

        if (
          event.target.closest(
            ".edit-task"
          )
        ) {
          openDialog(
            TaskStore.byId(id)
          );
        }

        if (
          event.target.closest(
            ".delete-task"
          )
        ) {
          deleteTask(id);
        }
      }
    );

    container.addEventListener(
      "change",
      event => {
        const row =
          event.target.closest(
            ".task-row"
          );

        if (
          row &&
          event.target.classList.contains(
            "task-check"
          )
        ) {
          toggleTask(
            row.dataset.id
          );
        }
      }
    );
  }

  /* =======================================================
     LIST VIEW
     ======================================================= */

  function renderCurrentList() {
    const view =
      state.listView;

    const labels = {
      today: [
        "03 / TASKS",
        "TODAY"
      ],

      upcoming: [
        "04 / TASKS",
        "UPCOMING"
      ],

      completed: [
        "05 / TASKS",
        "COMPLETED"
      ],

      overdue: [
        "06 / TASKS",
        "OVERDUE"
      ],

      high: [
        "07 / TASKS",
        "HIGH PRIORITY"
      ],

      categories: [
        "08 / TASKS",
        "CATEGORIES"
      ]
    };

    const label =
      labels[view] || [
        "03 / TASKS",
        "TASKS"
      ];

    $("#listEyebrow")
      && ($("#listEyebrow").textContent =
        label[0]);

    $("#listTitle")
      && ($("#listTitle").textContent =
        label[1]);

    if (!els.listTaskList) {
      return;
    }

    const list =
      TaskStore.filter({
        view:
          view === "categories"
            ? "all"
            : view,

        search:
          els.listSearch?.value ||
          "",

        category:
          els.categoryFilter?.value ||
          ""
      });

    els.listTaskList.innerHTML =
      taskRows(list);
  }

  /* =======================================================
     CATEGORIES
     ======================================================= */

  function renderCategories() {
    const categories =
      TaskStore.categories();

    if (els.categoryFilter) {
      els.categoryFilter.innerHTML =
        `
          <option value="">
            ALL CATEGORIES
          </option>
        ` +
        categories
          .map(
            category =>
              `
                <option value="${escapeHTML(
                  category
                )}">
                  ${escapeHTML(
                    category
                  )}
                </option>
              `
          )
          .join("");
    }

    if (els.categoryOptions) {
      els.categoryOptions.innerHTML =
        categories
          .map(
            category =>
              `
                <option
                  value="${escapeHTML(
                    category
                  )}"
                ></option>
              `
          )
          .join("");
    }
  }

  /* =======================================================
     CALENDAR
     ======================================================= */

  function renderCalendar() {
    if (!els.calendarGrid) {
      return;
    }

    const date =
      state.calendarDate;

    const year =
      date.getFullYear();

    const month =
      date.getMonth();

    if (els.calendarTitle) {
      els.calendarTitle.textContent =
        date
          .toLocaleDateString(
            undefined,
            {
              month: "long",
              year: "numeric"
            }
          )
          .toUpperCase();
    }

    const first =
      new Date(
        year,
        month,
        1
      );

    const last =
      new Date(
        year,
        month + 1,
        0
      );

    const start =
      first.getDay();

    const totalCells =
      Math.ceil(
        (start +
          last.getDate()) /
          7
      ) * 7;

    const tasks =
      TaskStore.all();

    let html = "";

    for (
      let index = 0;
      index < totalCells;
      index++
    ) {
      const day =
        index -
        start +
        1;

      const cellDate =
        new Date(
          year,
          month,
          day
        );

      const inMonth =
        cellDate.getMonth() ===
        month;

      const key =
        TaskStore.dateKey(
          cellDate
        );

      const dayTasks =
        tasks.filter(
          task =>
            task.date === key
        );

      html += `
        <div
          class="
            calendar-cell
            ${inMonth ? "" : "other"}
            ${
              key ===
              TaskStore.dateKey()
                ? "today"
                : ""
            }
          "
        >

          <div class="calendar-day">
            ${cellDate.getDate()}
          </div>

          ${dayTasks
            .slice(0, 3)
            .map(
              task => `
                <div
                  class="
                    calendar-task
                    ${task.priority}
                  "
                >
                  ${
                    task.completed
                      ? "■"
                      : "□"
                  }

                  ${escapeHTML(
                    task.title
                  )}
                </div>
              `
            )
            .join("")}

          ${
            dayTasks.length > 3
              ? `
                <div class="calendar-more">
                  +${
                    dayTasks.length - 3
                  } MORE
                </div>
              `
              : ""
          }

        </div>
      `;
    }

    els.calendarGrid.innerHTML =
      html;
  }

  /* =======================================================
     DIALOG
     ======================================================= */

  function openDialog(task = null) {
    if (
      !els.dialog ||
      !els.form
    ) {
      return;
    }

    state.editingId =
      task?.id || null;

    els.form.reset();

    if (els.formError) {
      els.formError.textContent =
        "";
    }

    if (els.dialogTitle) {
      els.dialogTitle.textContent =
        task
          ? "EDIT TASK"
          : "NEW TASK";
    }

    if (els.taskId) {
      els.taskId.value =
        task?.id || "";
    }

    if (els.taskTitle) {
      els.taskTitle.value =
        task?.title || "";
    }

    if (els.taskDescription) {
      els.taskDescription.value =
        task?.description || "";
    }

    if (els.taskDate) {
      els.taskDate.value =
        task?.date ||
        TaskStore.dateKey();
    }

    if (els.taskTime) {
      els.taskTime.value =
        task?.time || "";
    }

    if (els.taskPriority) {
      els.taskPriority.value =
        task?.priority ||
        "medium";
    }

    if (els.taskCategory) {
      els.taskCategory.value =
        task?.category || "";
    }

    if (els.notificationEnabled) {
      els.notificationEnabled.checked =
        task?.notification_enabled ??
        true;
    }

    if (els.notificationTime) {
      els.notificationTime.value =
        String(
          task?.notification_time ??
            10
        );
    }

    try {
      if (!els.dialog.open) {
        els.dialog.showModal();
      }
    } catch {
      els.dialog.setAttribute(
        "open",
        ""
      );
    }

    els.taskTitle?.focus();
  }

  function closeDialog() {
    if (!els.dialog) return;

    if (
      typeof els.dialog.close ===
      "function"
    ) {
      els.dialog.close();
    } else {
      els.dialog.removeAttribute(
        "open"
      );
    }

    state.editingId = null;
  }

  /* =======================================================
     FORM SUBMIT
     ======================================================= */

  function getFormPayload() {
    const title =
      els.taskTitle?.value
        .trim() || "";

    if (!title) {
      throw new Error(
        "TASK TITLE IS REQUIRED."
      );
    }

    const date =
      els.taskDate?.value || "";

    if (!date) {
      throw new Error(
        "TASK DATE IS REQUIRED."
      );
    }

    return {
      title,

      description:
        els.taskDescription?.value
          .trim() || "",

      date,

      time:
        els.taskTime?.value || null,

      priority:
        els.taskPriority?.value ||
        "medium",

      category:
        els.taskCategory?.value
          .trim() ||
        "GENERAL",

      notification_enabled:
        Boolean(
          els.notificationEnabled
            ?.checked
        ),

      notification_time:
        Number(
          els.notificationTime
            ?.value || 10
        ),

      updated_at:
        new Date().toISOString()
    };
  }

  /* =======================================================
     VIEW SWITCHING
     ======================================================= */

  function switchView(view) {
    state.view = view;

    $$(".view").forEach(
      element =>
        element.classList.remove(
          "active"
        )
    );

    $$(".nav-item").forEach(
      element =>
        element.classList.remove(
          "active"
        )
    );

    const nav =
      document.querySelector(
        `.nav-item[data-view="${view}"]`
      );

    nav?.classList.add(
      "active"
    );

    if (view === "dashboard") {
      $("#dashboardView")
        ?.classList.add(
          "active"
        );

    } else if (view === "calendar") {
      $("#calendarView")
        ?.classList.add(
          "active"
        );

    } else if (view === "settings") {
      $("#settingsView")
        ?.classList.add(
          "active"
        );

    } else {
      $("#listView")
        ?.classList.add(
          "active"
        );

      state.listView =
        view;

      renderCurrentList();
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  /* =======================================================
     CLOCK
     ======================================================= */

  function updateClock() {
    const now =
      new Date();

    const time =
      now.toLocaleTimeString(
        [],
        {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        }
      );

    const date =
      formatDate(now);

    if (els.topClock) {
      els.topClock.textContent =
        time;
    }

    if (els.largeClock) {
      els.largeClock.textContent =
        time;
    }

    if (els.topDate) {
      els.topDate.textContent =
        date;
    }

    if (els.largeDate) {
      els.largeDate.textContent =
        date;
    }
  }

  /* =======================================================
     EVENTS
     ======================================================= */

  function bindEvents() {
    $$(".nav-item").forEach(
      button => {
        button.addEventListener(
          "click",
          () =>
            switchView(
              button.dataset.view
            )
        );
      }
    );

    $$("[data-action='new-task']")
      .forEach(
        button =>
          button.addEventListener(
            "click",
            () => openDialog()
          )
      );

    $("#newTaskBtn")
      ?.addEventListener(
        "click",
        () => openDialog()
      );

    $("#closeDialog")
      ?.addEventListener(
        "click",
        closeDialog
      );

    $("#cancelTask")
      ?.addEventListener(
        "click",
        closeDialog
      );

    els.dialog?.addEventListener(
      "cancel",
      event => {
        event.preventDefault();
        closeDialog();
      }
    );

    els.form?.addEventListener(
      "submit",
      async event => {
        event.preventDefault();

        try {
          const payload =
            getFormPayload();

          await saveTask(
            payload,
            state.editingId
          );

        } catch (error) {
          if (els.formError) {
            els.formError.textContent =
              error.message;
          }
        }
      }
    );

    bindTaskList(
      els.taskList
    );

    bindTaskList(
      els.listTaskList
    );

    els.taskSearch?.addEventListener(
      "input",
      () =>
        renderDashboard(
          TaskStore.all()
        )
    );

    els.quickFilter?.addEventListener(
      "change",
      () =>
        renderDashboard(
          TaskStore.all()
        )
    );

    els.listSearch?.addEventListener(
      "input",
      renderCurrentList
    );

    els.categoryFilter?.addEventListener(
      "change",
      renderCurrentList
    );

    $("#calendarPrev")
      ?.addEventListener(
        "click",
        () => {
          state.calendarDate.setMonth(
            state.calendarDate.getMonth() -
              1
          );

          renderCalendar();
        }
      );

    $("#calendarNext")
      ?.addEventListener(
        "click",
        () => {
          state.calendarDate.setMonth(
            state.calendarDate.getMonth() +
              1
          );

          renderCalendar();
        }
      );

    $("#calendarToday")
      ?.addEventListener(
        "click",
        () => {
          state.calendarDate =
            new Date();

          renderCalendar();
        }
      );

    $("#refreshBtn")
      ?.addEventListener(
        "click",
        refresh
      );

    window.addEventListener(
      "online",
      refresh
    );

    window.addEventListener(
      "offline",
      () => setConnection(false)
    );
  }

  /* =======================================================
     BOOT
     ======================================================= */

  async function boot() {
    try {
      if (els.bootText) {
        els.bootText.textContent =
          "INITIALIZING TODO MACHINE...";
      }

      if (els.bootProgress) {
        els.bootProgress.style.width =
          "25%";
      }

      bindEvents();

      if (els.bootProgress) {
        els.bootProgress.style.width =
          "50%";
      }

      updateClock();

      setInterval(
        updateClock,
        1000
      );

      if (els.bootProgress) {
        els.bootProgress.style.width =
          "75%";
      }

      await refresh();

      if (window.Notifications) {
        Notifications.start(
          () => TaskStore.all()
        );
      }

      if (els.bootProgress) {
        els.bootProgress.style.width =
          "100%";
      }

      setTimeout(
        () => {
          els.boot?.classList.add(
            "hidden"
          );
        },
        500
      );

    } catch (error) {
      console.error(
        "[APP] Boot failed:",
        error
      );

      els.boot?.classList.add(
        "hidden"
      );

      toast(
        "BOOT ERROR",
        error.message ||
          "Application failed to initialize."
      );
    }
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      boot,
      { once: true }
    );
  } else {
    boot();
  }

  /* =======================================================
     PUBLIC APP API
     ======================================================= */

  window.TodoMachine = {
    refresh,
    openDialog,
    closeDialog,
    switchView,
    renderAll
  };
})();