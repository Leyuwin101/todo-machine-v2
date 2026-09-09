
(() => {
  "use strict";

  /* =========================================================
     TODO MACHINE — APP CONTROLLER
     Connected to the supplied HTML structure.
     ========================================================= */

  const $ = (selector) =>
    document.querySelector(selector);

  const $$ = (selector) =>
    [...document.querySelectorAll(selector)];

  /* =========================================================
     STATE
     ========================================================= */

  const state = {
    view: "dashboard",
    listView: "today",
    calendarDate: new Date(),
    editingId: null,
    deferredInstallPrompt: null,
    soundEnabled: true
  };

  /* =========================================================
     DOM REFERENCES
     ========================================================= */

  const els = {
    /* Boot */
    boot: $("#bootScreen"),
    bootText: $("#bootText"),
    bootProgress: $("#bootProgress"),
    skipBoot: $("#skipBoot"),

    /* Header */
    topClock: $("#topClock"),
    topDate: $("#topDate"),
    connectionDot: $("#connectionDot"),
    connectionText: $("#connectionText"),

    /* System status */
    dbStatus: $("#dbStatus"),
    taskCountStatus: $("#taskCountStatus"),
    nextReminderStatus: $("#nextReminderStatus"),
    appModeStatus: $("#appModeStatus"),
    footerStatus: $("#footerStatus"),

    /* Dashboard */
    taskList: $("#taskList"),
    todayWidgetList: $("#todayWidgetList"),
    todayCount: $("#todayCount"),
    nextTaskContent: $("#nextTaskContent"),
    progressContent: $("#progressContent"),

    /* Dashboard search */
    taskSearch: $("#taskSearch"),
    quickFilter: $("#quickFilter"),

    /* Main list */
    listTaskList: $("#listTaskList"),
    listSearch: $("#listSearch"),
    categoryFilter: $("#categoryFilter"),
    categoryOptions: $("#categoryOptions"),

    /* Calendar */
    calendarGrid: $("#calendarGrid"),
    calendarTitle: $("#calendarTitle"),
    prevMonth: $("#prevMonth"),
    nextMonth: $("#nextMonth"),

    /* Task dialog */
    dialog: $("#taskDialog"),
    form: $("#taskForm"),
    dialogTitle: $("#dialogTitle"),
    closeDialog: $("#closeDialog"),
    cancelDialog: $("#cancelDialog"),
    formError: $("#formError"),

    /* Task fields */
    taskId: $("#taskId"),
    taskTitle: $("#taskTitle"),
    taskDescription: $("#taskDescription"),
    taskDate: $("#taskDate"),
    taskTime: $("#taskTime"),
    taskPriority: $("#taskPriority"),
    taskCategory: $("#taskCategory"),
    notificationEnabled: $("#notificationEnabled"),
    notificationTime: $("#notificationTime"),

    /* Notifications */
    notifyButton: $("#notifyButton"),
    settingsNotifyBtn: $("#settingsNotifyBtn"),

    /* PWA */
    installAppBtn: $("#installAppBtn"),
    settingsInstallBtn: $("#settingsInstallBtn"),

    /* Settings */
    settingsAppMode: $("#settingsAppMode"),
    settingsSwStatus: $("#settingsSwStatus"),
    settingsSoundToggle: $("#settingsSoundToggle"),
    settingsTestSound: $("#settingsTestSound"),

    /* Sound dialog */
    soundDialog: $("#soundDialog"),
    closeSoundDialog: $("#closeSoundDialog"),
    closeSoundSettings: $("#closeSoundSettings"),
    notificationSoundToggle: $("#notificationSoundToggle"),
    testNotificationSound: $("#testNotificationSound"),

    /* Toast / offline */
    toastRegion: $("#toastRegion"),
    offlineBanner: $("#offlineBanner"),

    /* Buttons */
    newTaskButton: $("#newTaskButton"),
    newTaskButtonSide: $("#newTaskButtonSide"),
    newTaskButtonList: $("#newTaskButtonList")
  };

  /* =========================================================
     HELPERS
     ========================================================= */

  function escapeHTML(value = "") {
    return String(value).replace(
      /[&<>"']/g,
      (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[char]
    );
  }

  function formatTime(time) {
    if (!time) return "NO TIME";

    const [hours, minutes] =
      String(time).split(":").map(Number);

    if (
      Number.isNaN(hours) ||
      Number.isNaN(minutes)
    ) {
      return "NO TIME";
    }

    const date = new Date();

    date.setHours(
      hours,
      minutes,
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

    let ms =
      new Date(dateTime).getTime() -
      Date.now();

    if (Number.isNaN(ms)) {
      return "NO DATE";
    }

    if (ms <= 0) {
      return "PAST DUE";
    }

    const days =
      Math.floor(ms / 86400000);

    ms %= 86400000;

    const hours =
      Math.floor(ms / 3600000);

    ms %= 3600000;

    const minutes =
      Math.floor(ms / 60000);

    return (
      `${days ? days + "D " : ""}` +
      `${String(hours).padStart(2, "0")}H ` +
      `${String(minutes).padStart(2, "0")}M`
    );
  }

  function toast(title, body) {
    if (!els.toastRegion) return;

    const node =
      document.createElement("div");

    node.className = "toast";

    node.innerHTML = `
      <strong>
        ${escapeHTML(title)}
      </strong>

      <div>
        ${escapeHTML(body)}
      </div>
    `;

    els.toastRegion.appendChild(node);

    setTimeout(() => {
      node.remove();
    }, 5000);
  }

  /* =========================================================
     CONNECTION STATUS
     ========================================================= */

  function setConnection(connected) {
    if (els.connectionDot) {
      els.connectionDot.classList.toggle(
        "offline",
        !connected
      );
    }

    if (els.connectionText) {
      els.connectionText.textContent =
        connected
          ? "DATABASE ONLINE"
          : "OFFLINE / DISCONNECTED";
    }

    if (els.dbStatus) {
      els.dbStatus.textContent =
        `DATABASE: ${
          connected
            ? "CONNECTED"
            : "OFFLINE"
        }`;
    }

    if (els.footerStatus) {
      els.footerStatus.textContent =
        connected
          ? "TASK DATABASE CONNECTED"
          : "OFFLINE — SYNC PENDING";
    }

    if (els.offlineBanner) {
      els.offlineBanner.classList.toggle(
        "hidden",
        connected
      );
    }
  }

  /* =========================================================
     DATABASE
     ========================================================= */

  async function refresh() {
    try {
      if (
        !window.TodoDB ||
        typeof TodoDB.listTasks !==
          "function"
      ) {
        throw new Error(
          "Database module is not loaded."
        );
      }

      const tasks =
        await TodoDB.listTasks();

      if (
        window.TaskStore &&
        typeof TaskStore.setTasks ===
          "function"
      ) {
        TaskStore.setTasks(tasks);
      }

      setConnection(true);

      return tasks;
    } catch (error) {
      setConnection(false);

      console.error(
        "TODO MACHINE DATABASE ERROR:",
        error
      );

      if (
        window.TodoDB &&
        typeof TodoDB.configured ===
          "function" &&
        !TodoDB.configured()
      ) {
        toast(
          "CONFIG REQUIRED",
          "Check js/config.js and your Supabase configuration."
        );
      } else {
        toast(
          "DATABASE ERROR",
          error.message ||
            "Unable to load tasks."
        );
      }

      return [];
    }
  }

  async function saveTask(
    payload,
    id = null
  ) {
    if (!window.TodoDB) {
      throw new Error(
        "Database module is not loaded."
      );
    }

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
        "DATABASE RECORD DELETED."
      );
    } catch (error) {
      console.error(error);

      toast(
        "DELETE ERROR",
        error.message ||
          "Unable to delete task."
      );
    }
  }

  async function toggleTask(id) {
    if (!window.TaskStore) return;

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
      console.error(error);

      toast(
        "UPDATE ERROR",
        error.message ||
          "Unable to update task."
      );
    }
  }

  /* =========================================================
     TASK RENDERING
     ========================================================= */

  function taskRows(tasks = []) {
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
      .map((task) => {
        const overdue =
          typeof TaskStore?.isOverdue ===
            "function"
            ? TaskStore.isOverdue(task)
            : false;

        const priority =
          task.priority || "medium";

        const priorityMark =
          priority === "high"
            ? "!!!"
            : priority === "medium"
            ? "!!"
            : "!";

        return `
          <article
            class="task-row"
            data-id="${escapeHTML(task.id)}"
          >

            <input
              class="task-check"
              type="checkbox"
              ${task.completed ? "checked" : ""}
              aria-label="Complete ${escapeHTML(
                task.title
              )}"
            >

            <div class="task-main">

              <div
                class="task-title ${
                  task.completed
                    ? "completed"
                    : ""
                }"
              >
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

                ${dateLabel(
                  task.date
                )}

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
              class="priority ${escapeHTML(
                priority
              )}"
            >
              ${priorityMark}
            </div>

            <div class="task-time">
              ${formatTime(
                task.time
              )}
            </div>

            <div class="task-actions">

              <button
                class="icon-button edit-task"
                title="Edit task"
                type="button"
              >
                EDIT
              </button>

              <button
                class="icon-button delete-task"
                title="Delete task"
                type="button"
              >
                DEL
              </button>

            </div>

          </article>
        `;
      })
      .join("");
  }

  function bindTaskList(container) {
    if (!container) return;

    container.addEventListener(
      "click",
      (event) => {
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

          return;
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
      (event) => {
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

  /* =========================================================
     DASHBOARD
     ========================================================= */

  function renderDashboard(tasks) {
    if (!window.TaskStore) return;

    const today =
      tasks.filter(
        TaskStore.isToday
      );

    const visible =
      TaskStore.filter({
        view:
          els.quickFilter?.value ||
          "today",

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

    /* Today widget */

    if (els.todayWidgetList) {
      if (!today.length) {
        els.todayWidgetList.innerHTML = `
          <div class="empty-state">
            NO TASKS FOR TODAY.
          </div>
        `;
      } else {
        els.todayWidgetList.innerHTML =
          today
            .slice(0, 5)
            .map(
              (task) => `
                <div class="mini-task">

                  <span>
                    ${
                      task.completed
                        ? "■"
                        : "□"
                    }
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
            .join("");
      }
    }

    /* Progress */

    const completed =
      today.filter(
        (task) =>
          task.completed
      ).length;

    const percentage =
      today.length
        ? Math.round(
            (completed /
              today.length) *
              100
          )
        : 0;

    if (els.progressContent) {
      els.progressContent.innerHTML = `
        <div class="progress-wrap">

          <div class="progress-bar">

            <div
              class="progress-fill"
              style="width:${percentage}%"
            ></div>

          </div>

          <div class="progress-text">
            ${completed}
            /
            ${today.length}
            COMPLETE —
            ${percentage}%
          </div>

        </div>
      `;
    }

    /* Next task */

    const next =
      TaskStore.next();

    if (els.nextTaskContent) {
      if (!next) {
        els.nextTaskContent.innerHTML = `
          <div class="widget-content empty-state">
            NO UPCOMING TASKS.
          </div>
        `;
      } else {
        const taskDateTime =
          TaskStore.taskDateTime(
            next
          );

        els.nextTaskContent.innerHTML = `
          <div class="widget-content">

            <div class="next-task-title">
              ${escapeHTML(
                next.title
              )}
            </div>

            <div class="next-task-time">
              ${dateLabel(
                next.date
              )}
              ·
              ${formatTime(
                next.time
              )}
            </div>

            <div class="countdown">
              STARTS IN
              ${countdown(
                taskDateTime
              )}
            </div>

          </div>
        `;
      }
    }
  }

  /* =========================================================
     LIST VIEW
     ========================================================= */

  function renderCurrentList() {
    if (
      !window.TaskStore ||
      !els.listTaskList
    ) {
      return;
    }

    const map = {
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

    const eyebrow =
      $("#listEyebrow");

    const title =
      $("#listTitle");

    if (eyebrow) {
      eyebrow.textContent =
        map[state.listView]?.[0] ||
        "03 / TASKS";
    }

    if (title) {
      title.textContent =
        map[state.listView]?.[1] ||
        "TASKS";
    }

    const list =
      TaskStore.filter({
        view:
          state.listView ===
          "categories"
            ? "all"
            : state.listView,

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

  /* =========================================================
     CATEGORIES
     ========================================================= */

  function renderCategories() {
    if (
      !window.TaskStore
    ) {
      return;
    }

    const categories =
      TaskStore.categories();

    if (els.categoryFilter) {
      const current =
        els.categoryFilter.value;

      els.categoryFilter.innerHTML =
        `
          <option value="">
            ALL CATEGORIES
          </option>
        ` +
        categories
          .map(
            (category) => `
              <option
                value="${escapeHTML(
                  category
                )}"
              >
                ${escapeHTML(
                  category
                )}
              </option>
            `
          )
          .join("");

      if (
        categories.includes(
          current
        )
      ) {
        els.categoryFilter.value =
          current;
      }
    }

    if (els.categoryOptions) {
      els.categoryOptions.innerHTML =
        categories
          .map(
            (category) => `
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

  /* =========================================================
     CALENDAR
     ========================================================= */

  function renderCalendar() {
    if (
      !els.calendarGrid ||
      !window.TaskStore
    ) {
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
        date.toLocaleDateString(
          undefined,
          {
            month: "long",
            year: "numeric"
          }
        ).toUpperCase();
    }

    const firstDay =
      new Date(
        year,
        month,
        1
      );

    const lastDay =
      new Date(
        year,
        month + 1,
        0
      );

    const start =
      firstDay.getDay();

    const totalDays =
      lastDay.getDate();

    const totalCells =
      Math.ceil(
        (start + totalDays) /
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
        index - start + 1;

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
          (task) =>
            task.date === key
        );

      const isToday =
        key ===
        TaskStore.dateKey();

      html += `
        <div
          class="
            calendar-cell
            ${inMonth ? "" : "other"}
            ${isToday ? "today" : ""}
          "
        >

          <div class="calendar-day">
            ${cellDate.getDate()}
          </div>

          ${dayTasks
            .slice(0, 3)
            .map(
              (task) => `
                <div
                  class="
                    calendar-task
                    ${escapeHTML(
                      task.priority ||
                        "medium"
                    )}
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
                    dayTasks.length -
                    3
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

  /* =========================================================
     RENDER EVERYTHING
     ========================================================= */

  function renderAll(tasks = []) {
    renderDashboard(tasks);
    renderCurrentList();
    renderCalendar();
    renderCategories();

    if (els.taskCountStatus) {
      els.taskCountStatus.textContent =
        `TASKS: ${tasks.length}`;
    }

    if (
      window.TaskStore &&
      typeof TaskStore.next ===
        "function"
    ) {
      const next =
        TaskStore.next();

      if (els.nextReminderStatus) {
        els.nextReminderStatus.textContent =
          `NEXT REMINDER: ${
            next
              ? formatTime(
                  next.time
                )
              : "NONE"
          }`;
      }
    }
  }

  /* =========================================================
     TASK DIALOG
     ========================================================= */

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
        (
          window.TaskStore &&
          typeof TaskStore.dateKey ===
            "function"
            ? TaskStore.dateKey()
            : new Date()
                .toISOString()
                .slice(0, 10)
        );
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

    if (
      typeof els.dialog.showModal ===
      "function"
    ) {
      els.dialog.showModal();
    } else {
      els.dialog.setAttribute(
        "open",
        ""
      );
    }

    setTimeout(() => {
      els.taskTitle?.focus();
    }, 50);
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

  async function handleSubmit(event) {
    event.preventDefault();

    if (els.formError) {
      els.formError.textContent =
        "";
    }

    const title =
      els.taskTitle?.value.trim() ||
      "";

    const date =
      els.taskDate?.value ||
      "";

    if (!title || !date) {
      if (els.formError) {
        els.formError.textContent =
          "TASK TITLE AND DATE ARE REQUIRED.";
      }

      return;
    }

    const time =
      els.taskTime?.value ||
      null;

    const notificationMinutes =
      Number(
        els.notificationTime?.value ||
          10
      );

    let notificationAt = null;

    if (
      els.notificationEnabled?.checked &&
      time
    ) {
      const taskDate =
        new Date(
          `${date}T${time}:00`
        );

      notificationAt =
        new Date(
          taskDate.getTime() -
            notificationMinutes *
              60000
        ).toISOString();
    }

    const existing =
      state.editingId &&
      window.TaskStore
        ? TaskStore.byId(
            state.editingId
          )
        : null;

    const payload = {
      title,

      description:
        els.taskDescription?.value.trim() ||
        "",

      date,

      time,

      priority:
        els.taskPriority?.value ||
        "medium",

      category:
        els.taskCategory?.value.trim() ||
        "General",

      completed:
        existing?.completed ||
        false,

      notification_enabled:
        els.notificationEnabled?.checked ??
        true,

      notification_time:
        notificationMinutes,

      notification_at:
        notificationAt,

      updated_at:
        new Date().toISOString()
    };

    if (existing?.created_at) {
      payload.created_at =
        existing.created_at;
    }

    try {
      await saveTask(
        payload,
        state.editingId
      );

      closeDialog();
    } catch (error) {
      console.error(error);

      if (els.formError) {
        els.formError.textContent =
          error.message ||
          "Unable to save task.";
      }
    }
  }

  /* =========================================================
     NAVIGATION
     ========================================================= */

  function switchView(view) {
    const validViews = [
      "dashboard",
      "calendar",
      "today",
      "upcoming",
      "completed",
      "overdue",
      "high",
      "categories",
      "settings"
    ];

    if (
      !validViews.includes(view)
    ) {
      view = "dashboard";
    }

    state.view = view;

    $$(".nav-button").forEach(
      (button) => {
        button.classList.toggle(
          "active",
          button.dataset.view ===
            view
        );
      }
    );

    $$(".view").forEach(
      (element) => {
        element.classList.remove(
          "active"
        );
      }
    );

    if (view === "dashboard") {
      $("#dashboardView")
        ?.classList.add(
          "active"
        );

      return;
    }

    if (view === "calendar") {
      $("#calendarView")
        ?.classList.add(
          "active"
        );

      renderCalendar();

      return;
    }

    if (view === "settings") {
      $("#settingsView")
        ?.classList.add(
          "active"
        );

      updateSettingsUI();

      return;
    }

    state.listView = view;

    $("#listView")
      ?.classList.add(
        "active"
      );

    renderCurrentList();
  }

  /* =========================================================
     CLOCK
     ========================================================= */

  function updateClock() {
    const now =
      new Date();

    const time =
      now.toLocaleTimeString(
        [],
        {
          hour: "2-digit",
          minute: "2-digit"
        }
      );

    if (els.topClock) {
      els.topClock.textContent =
        time;
    }

    if (els.topDate) {
      els.topDate.textContent =
        now.toLocaleDateString();
    }

    if (els.largeClock) {
      els.largeClock.textContent =
        time;
    }

    if (els.largeDate) {
      els.largeDate.textContent =
        formatDate(now);
    }

    /* Update countdown */

    if (
      state.view === "dashboard" &&
      window.TaskStore &&
      els.nextTaskContent
    ) {
      const next =
        TaskStore.next();

      const countdownElement =
        els.nextTaskContent.querySelector(
          ".countdown"
        );

      if (
        next &&
        countdownElement
      ) {
        countdownElement.textContent =
          `STARTS IN ${countdown(
            TaskStore.taskDateTime(
              next
            )
          )}`;
      }
    }
  }

  /* =========================================================
     BOOT SCREEN
     ========================================================= */

  function boot() {
    if (
      !els.boot ||
      !els.bootText ||
      !els.bootProgress
    ) {
      return;
    }

    const lines = [
      "BOOTING TODO MACHINE...",
      "LOADING TASK DATABASE...",
      "INITIALIZING CLOCK...",
      "CHECKING NOTIFICATIONS...",
      "SYSTEM READY."
    ];

    let index = 0;

    const finish = () => {
      els.boot?.remove();
    };

    const timer =
      setInterval(() => {
        els.bootText.textContent =
          lines[
            Math.min(
              index,
              lines.length - 1
            )
          ];

        els.bootProgress.style.width =
          `${Math.min(
            100,
            ((index + 1) /
              lines.length) *
              100
          )}%`;

        index++;

        if (
          index >= lines.length
        ) {
          clearInterval(timer);

          setTimeout(
            finish,
            250
          );
        }
      }, 220);

    if (els.skipBoot) {
      els.skipBoot.onclick =
        () => {
          clearInterval(
            timer
          );

          finish();
        };
    }
  }

  /* =========================================================
     PWA INSTALL
     ========================================================= */

  function isStandalone() {
    return (
      window.matchMedia?.(
        "(display-mode: standalone)"
      ).matches ||
      window.navigator.standalone ===
        true
    );
  }

  function updateAppMode() {
    const installed =
      isStandalone();

    const mode =
      installed
        ? "STANDALONE MODE"
        : "BROWSER MODE";

    if (els.appModeStatus) {
      els.appModeStatus.textContent =
        mode;
    }

    if (els.settingsAppMode) {
      els.settingsAppMode.textContent =
        mode;
    }

    if (
      installed &&
      els.installAppBtn
    ) {
      els.installAppBtn.hidden =
        true;
    }
  }

  async function installApp() {
    if (
      !state.deferredInstallPrompt
    ) {
      toast(
        "INSTALL",
        isStandalone()
          ? "TODO MACHINE IS ALREADY INSTALLED."
          : "INSTALL PROMPT IS NOT AVAILABLE. USE YOUR BROWSER'S INSTALL OPTION."
      );

      return;
    }

    try {
      state.deferredInstallPrompt.prompt();

      const result =
        await state.deferredInstallPrompt
          .userChoice;

      if (
        result.outcome ===
        "accepted"
      ) {
        toast(
          "INSTALLING",
          "TODO MACHINE IS BEING INSTALLED."
        );
      }

      state.deferredInstallPrompt =
        null;

      if (els.installAppBtn) {
        els.installAppBtn.hidden =
          true;
      }
    } catch (error) {
      console.error(
        "PWA INSTALL ERROR:",
        error
      );
    }
  }

  /* NOTE: install buttons, beforeinstallprompt and
     appinstalled are handled by pwa.js. Wiring them here
     as well fired installApp() twice per click, which
     broke the install prompt. This module only mirrors
     the display mode into the status labels. */

  function setupPWAInstall() {
    window.addEventListener(
      "appinstalled",
      () => {
        updateAppMode();
      }
    );

    updateAppMode();
  }

  /* =========================================================
     SERVICE WORKER STATUS
     ========================================================= */

  async function updateServiceWorkerStatus() {
    if (
      !els.settingsSwStatus
    ) {
      return;
    }

    if (
      !("serviceWorker" in navigator)
    ) {
      els.settingsSwStatus.textContent =
        "NOT SUPPORTED";

      return;
    }

    try {
      const registration =
        await navigator.serviceWorker.getRegistration();

      els.settingsSwStatus.textContent =
        registration
          ? "ACTIVE"
          : "NOT REGISTERED";
    } catch {
      els.settingsSwStatus.textContent =
        "ERROR";
    }
  }

  async function registerServiceWorker() {
    if (
      !("serviceWorker" in navigator)
    ) {
      updateServiceWorkerStatus();
      return;
    }

    try {
      await navigator.serviceWorker.register(
        "./sw.js"
      );

      updateServiceWorkerStatus();
    } catch (error) {
      console.error(
        "SERVICE WORKER ERROR:",
        error
      );

      if (
        els.settingsSwStatus
      ) {
        els.settingsSwStatus.textContent =
          "ERROR";
      }
    }
  }

  /* =========================================================
     NOTIFICATIONS
     ========================================================= */

  function isIOSDevice() {
    return /iphone|ipad|ipod/i.test(
      navigator.userAgent
    );
  }

  async function enableNotifications() {
    try {
      if (
        !window.Notifications ||
        typeof Notifications.enablePush !==
          "function"
      ) {
        toast(
          "NOTIFICATIONS",
          "Notification system is not loaded."
        );

        return;
      }

      if (
        typeof Notifications.isPushSupported ===
          "function" &&
        !Notifications.isPushSupported()
      ) {
        toast(
          "NOTIFICATIONS",
          isIOSDevice()
            ? "THIS BROWSER CANNOT RECEIVE PUSH. ADD TODO MACHINE TO YOUR HOME SCREEN (SHARE > ADD TO HOME SCREEN), THEN ENABLE REMINDERS FROM THE INSTALLED APP."
            : "THIS BROWSER DOES NOT SUPPORT PUSH NOTIFICATIONS."
        );

        return;
      }

      const result =
        await Notifications.enablePush();

      if (
        result?.status ===
        "subscribed"
      ) {
        toast(
          "PUSH ENABLED",
          "SERVER REMINDERS ARE NOW REGISTERED FOR THIS DEVICE."
        );
      } else {
        toast(
          "NOTIFICATIONS",
          `PERMISSION: ${
            result?.status ||
            "UNKNOWN"
          }`
        );
      }
    } catch (error) {
      console.error(error);

      toast(
        "PUSH SETUP ERROR",
        error.message ||
          "Unable to enable notifications."
      );
    }
  }

  /* =========================================================
     RETRO SOUND
     ========================================================= */

  /* Sound preference is owned by notifications.js
     (single key: todoMachineNotificationSound) so both
     toggles always stay in sync. */

  function loadSoundPreference() {
    state.soundEnabled =
      window.Notifications &&
      typeof Notifications.isNotificationSoundEnabled ===
        "function"
        ? Notifications.isNotificationSoundEnabled()
        : true;
  }

  function setSoundEnabled(enabled) {
    state.soundEnabled =
      Boolean(enabled);

    if (
      window.Notifications &&
      typeof Notifications.setNotificationSoundEnabled ===
        "function"
    ) {
      Notifications.setNotificationSoundEnabled(
        state.soundEnabled
      );
    }
  }

  function playRetroBeep() {
    if (!state.soundEnabled) {
      return;
    }

    try {
      const AudioContext =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioContext) {
        return;
      }

      const context =
        new AudioContext();

      const oscillator =
        context.createOscillator();

      const gain =
        context.createGain();

      oscillator.type =
        "square";

      oscillator.frequency.value =
        880;

      gain.gain.setValueAtTime(
        0.08,
        context.currentTime
      );

      gain.gain.exponentialRampToValueAtTime(
        0.001,
        context.currentTime +
          0.18
      );

      oscillator.connect(
        gain
      );

      gain.connect(
        context.destination
      );

      oscillator.start();

      oscillator.stop(
        context.currentTime +
          0.18
      );

      oscillator.onended =
        () => {
          context.close();
        };
    } catch (error) {
      console.warn(
        "Sound unavailable:",
        error
      );
    }
  }

  function openSoundDialog() {
    if (
      !els.soundDialog
    ) {
      return;
    }

    if (
      typeof els.soundDialog.showModal ===
      "function"
    ) {
      els.soundDialog.showModal();
    } else {
      els.soundDialog.setAttribute(
        "open",
        ""
      );
    }
  }

  function closeSoundDialog() {
    if (
      !els.soundDialog
    ) {
      return;
    }

    if (
      typeof els.soundDialog.close ===
      "function"
    ) {
      els.soundDialog.close();
    } else {
      els.soundDialog.removeAttribute(
        "open"
      );
    }
  }

  /* =========================================================
     SETTINGS
     ========================================================= */

  async function updateSettingsUI() {
    updateAppMode();
    updateServiceWorkerStatus();

    /* Ask the notification module for the real push state
       so the label always matches the sidebar button. */

    if (
      els.settingsNotifyBtn &&
      window.Notifications &&
      typeof Notifications.getPushStatus ===
        "function"
    ) {
      try {
        const status =
          await Notifications.getPushStatus();

        if (status.supported) {
          els.settingsNotifyBtn.textContent =
            status.subscribed
              ? "ENABLED"
              : status.permission === "denied"
                ? "BLOCKED"
                : "ENABLE";
        } else {
          els.settingsNotifyBtn.textContent =
            "NOT SUPPORTED";
        }
      } catch {
        /* registration not ready yet */
      }
    }
  }

  /* =========================================================
     EVENT BINDING
     ========================================================= */

  function setupNavigation() {
    $$(".nav-button").forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            switchView(
              button.dataset.view
            );
          }
        );
      }
    );
  }

  function setupTaskButtons() {
    els.newTaskButton?.addEventListener(
      "click",
      () => openDialog()
    );

    els.newTaskButtonSide?.addEventListener(
      "click",
      () => openDialog()
    );

    els.newTaskButtonList?.addEventListener(
      "click",
      () => openDialog()
    );
  }

  function setupTaskDialog() {
    els.closeDialog?.addEventListener(
      "click",
      closeDialog
    );

    els.cancelDialog?.addEventListener(
      "click",
      closeDialog
    );

    els.form?.addEventListener(
      "submit",
      handleSubmit
    );

    /* Close when clicking dialog backdrop */

    els.dialog?.addEventListener(
      "click",
      (event) => {
        if (
          event.target ===
          els.dialog
        ) {
          closeDialog();
        }
      }
    );
  }

  function setupSearchAndFilters() {
    els.taskSearch?.addEventListener(
      "input",
      () => {
        renderDashboard(
          TaskStore.all()
        );
      }
    );

    els.quickFilter?.addEventListener(
      "change",
      () => {
        renderDashboard(
          TaskStore.all()
        );
      }
    );

    els.listSearch?.addEventListener(
      "input",
      renderCurrentList
    );

    els.categoryFilter?.addEventListener(
      "change",
      renderCurrentList
    );
  }

  function setupCalendar() {
    els.prevMonth?.addEventListener(
      "click",
      () => {
        state.calendarDate.setMonth(
          state.calendarDate.getMonth() -
            1
        );

        renderCalendar();
      }
    );

    els.nextMonth?.addEventListener(
      "click",
      () => {
        state.calendarDate.setMonth(
          state.calendarDate.getMonth() +
            1
        );

        renderCalendar();
      }
    );
  }

  function setupNotifications() {
    els.notifyButton?.addEventListener(
      "click",
      enableNotifications
    );

    els.settingsNotifyBtn?.addEventListener(
      "click",
      enableNotifications
    );
  }

  /* NOTE: sound toggles and test-sound buttons are wired
     once inside notifications.js (their DOMContentLoaded
     handler). Wiring them here too would fire every change
     twice and desync the two preference keys. */

  function setupSoundSettings() {
    els.closeSoundDialog?.addEventListener(
      "click",
      closeSoundDialog
    );

    els.closeSoundSettings?.addEventListener(
      "click",
      closeSoundDialog
    );

    els.soundDialog?.addEventListener(
      "click",
      (event) => {
        if (
          event.target ===
          els.soundDialog
        ) {
          closeSoundDialog();
        }
      }
    );
  }

  /* =========================================================
     DATABASE EVENTS
     ========================================================= */

  function setupDatabaseEvents() {
    window.addEventListener(
      "db:status",
      (event) => {
        if (
          event.detail &&
          typeof event.detail.connected !==
            "undefined"
        ) {
          setConnection(
            event.detail.connected
          );
        }
      }
    );

    window.addEventListener(
      "todo:toast",
      (event) => {
        toast(
          event.detail?.title ||
            "TODO MACHINE",
          event.detail?.body ||
            ""
        );
      }
    );

    window.addEventListener(
      "task:open",
      (event) => {
        const id =
          event.detail?.id;

        if (
          id &&
          window.TaskStore
        ) {
          openDialog(
            TaskStore.byId(id)
          );
        }
      }
    );

    window.addEventListener(
      "online",
      () => {
        refresh();
      }
    );

    window.addEventListener(
      "offline",
      () => {
        setConnection(false);

        toast(
          "OFFLINE MODE",
          "CHANGES WILL SYNC WHEN CONNECTION RETURNS."
        );
      }
    );

    window.addEventListener(
      "todo:sound-changed",
      (event) => {
        /* Keep app state in sync when the toggles wired
           inside notifications.js change the setting. */

        if (
          typeof event.detail?.enabled ===
          "boolean"
        ) {
          state.soundEnabled =
            event.detail.enabled;
        }
      }
    );

    window.addEventListener(
      "storage",
      (event) => {
        if (
          event.key ===
          "todoMachineNotificationSound"
        ) {
          loadSoundPreference();
        }
      }
    );
  }

  /* =========================================================
     TASK STORE
     ========================================================= */

  function setupTaskStore() {
    if (
      !window.TaskStore ||
      typeof TaskStore.subscribe !==
        "function"
    ) {
      console.warn(
        "TaskStore is not available."
      );

      return;
    }

    TaskStore.subscribe(
      renderAll
    );
  }

  /* =========================================================
     REALTIME
     ========================================================= */

  function setupRealtime() {
    if (
      window.TodoDB &&
      typeof TodoDB.connectRealtime ===
        "function"
    ) {
      try {
        TodoDB.connectRealtime(
          () => {
            refresh();
          }
        );
      } catch (error) {
        console.warn(
          "Realtime connection failed:",
          error
        );
      }
    }
  }

  /* =========================================================
     NOTIFICATION WATCHER
     ========================================================= */

  function setupNotificationWatcher() {
    if (
      window.Notifications &&
      typeof Notifications.start ===
        "function"
    ) {
      try {
        Notifications.start(
          () =>
            window.TaskStore
              ? TaskStore.all()
              : []
        );
      } catch (error) {
        console.warn(
          "Notification watcher failed:",
          error
        );
      }
    }
  }

  /* =========================================================
     MAIN SETUP
     ========================================================= */

  async function setup() {
    /* Boot */

    boot();

    /* Clock */

    updateClock();

    setInterval(
      updateClock,
      1000
    );

    /* Preferences */

    loadSoundPreference();

    /* UI */

    setupNavigation();
    setupTaskButtons();
    setupTaskDialog();
    setupSearchAndFilters();
    setupCalendar();
    setupNotifications();
    setupSoundSettings();

    /* Task lists */

    bindTaskList(
      els.taskList
    );

    bindTaskList(
      els.listTaskList
    );

    /* Events */

    setupDatabaseEvents();

    /* PWA */

    setupPWAInstall();

    /* Service worker */

    registerServiceWorker();

    /* TaskStore */

    setupTaskStore();

    /* Realtime */

    setupRealtime();

    /* Notification watcher */

    setupNotificationWatcher();

    /* Initial UI */

    updateSettingsUI();

    /* Database */

    await refresh();
  }

  /* =========================================================
     START
     ========================================================= */

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      setup,
      {
        once: true
      }
    );
  } else {
    setup();
  }
})();

