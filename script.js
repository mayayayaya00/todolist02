const addBtn = document.getElementById('addBtn');
const taskInput = document.getElementById('taskInput');
const taskDate = document.getElementById('taskDate');
const repeatType = document.getElementById('repeatType');
const repeatCountInput = document.getElementById('repeatCount');
const calendar = document.getElementById('calendar');
const viewTitle = document.getElementById('viewTitle');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const viewModeSel = document.getElementById('viewMode');
const progressBarBox = document.getElementById('progressBarBox');
const memoArea = document.getElementById('memoArea');
const memoMonth = document.getElementById('memoMonth');

let today = new Date();
today.setHours(0, 0, 0, 0);
let weekOffset = 0;
let currentViewMode = 'week';
let currentPriority = '中';
const WEEK_DAYS = ['日', '月', '火', '水', '木', '金', '土'];
let tasks = [];

function loadTasks() {
  firebase.database().ref('tasks').on('value', (snapshot) => {
    tasks = [];
    snapshot.forEach(childSnapshot => {
      tasks.push({
        id: childSnapshot.key,
        ...childSnapshot.val()
      });
    });
    showCalendar();
  });
}

document.querySelectorAll('.priority-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.priority-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    currentPriority = this.dataset.priority;
  });
});

viewModeSel.value = currentViewMode;
viewModeSel.addEventListener('change', function () {
  currentViewMode = this.value;
  weekOffset = 0;
  showCalendar();
  showMemo();
});
prevBtn.addEventListener('click', () => {
  weekOffset--;
  showCalendar();
  showMemo();
});
nextBtn.addEventListener('click', () => {
  weekOffset++;
  showCalendar();
  showMemo();
});
addBtn.addEventListener('click', addTask);
taskInput.addEventListener('keypress', function (event) {
  if (event.key === 'Enter') addTask();
});

memoArea.addEventListener('input', function () {
  const key = getMemoKey();
  firebase.database().ref('memos/' + key).set(memoArea.value);
});

function getMemoKey() {
  let date;
  if (currentViewMode === 'week') {
    const now = new Date(today.getTime());
    now.setDate(now.getDate() + weekOffset * 7);
    date = now;
  } else {
    date = new Date(today.getFullYear(), today.getMonth() + weekOffset, 1);
  }
  return `${date.getFullYear()}-${('0'+(date.getMonth()+1)).slice(-2)}`;
}

function showMemo() {
  const key = getMemoKey();
  memoMonth.textContent = key.replace('-', '年') + '月';
  firebase.database().ref('memos/' + key).on('value', (snapshot) => {
    memoArea.value = snapshot.val() || '';
  });
}

function addTask() {
  const text = taskInput.value.trim();
  const dateStr = taskDate.value;
  const priority = currentPriority;
  if (text === '' || dateStr === '') return;

  const repeat = repeatType.value;
  const repeatCount = parseInt(repeatCountInput.value) || 1;
  let baseDate = new Date(dateStr + 'T00:00:00');

  for (let i = 0; i < repeatCount; i++) {
    let newDate = new Date(baseDate.getTime());
    switch (repeat) {
      case 'daily':
        newDate.setDate(baseDate.getDate() + i);
        break;
      case 'weekly':
        newDate.setDate(baseDate.getDate() + i * 7);
        break;
      case 'monthly':
        newDate.setMonth(baseDate.getMonth() + i);
        break;
      case 'none':
      default:
        break;
    }
    firebase.database().ref('tasks').push({
      text: text,
      date: formatDateForKey(newDate),
      priority: priority,
      completed: false,
      repeat: repeat,
      created: Date.now()
    });
  }

  taskInput.value = '';
}

function showCalendar() {
  calendar.innerHTML = '';
  setProgressBar();
  if (currentViewMode === 'week') {
    showWeekView();
  } else {
    showMonthView();
  }
}

function showWeekView() {
  const now = new Date(today.getTime());
  now.setDate(now.getDate() + weekOffset * 7);
  const weekStart = new Date(now.getTime());
  weekStart.setDate(now.getDate() - now.getDay());
  const weekDates = [];
  for (let i = 0; i < 7; ++i) {
    let d = new Date(weekStart.getTime());
    d.setDate(weekStart.getDate() + i);
    weekDates.push(d);
  }
  const startStr = formatDate(weekDates[0]);
  const endStr = formatDate(weekDates[6]);
  viewTitle.textContent = `${startStr} 〜 ${endStr}`;
  const weekRow = document.createElement('div');
  weekRow.className = 'week-row';
  for (let i = 0; i < 7; ++i) {
    const dayCell = document.createElement('div');
    dayCell.className = 'day-cell';
    if (isToday(weekDates[i])) {
      dayCell.classList.add('today');
    }
    addDropTargetEvents(dayCell, formatDateForKey(weekDates[i]));
    const head = document.createElement('div');
    head.className = 'day-header';
    head.textContent = WEEK_DAYS[i];
    dayCell.appendChild(head);
    const dateDiv = document.createElement('div');
    dateDiv.className = 'day-date';
    dateDiv.textContent = formatDateYMD(weekDates[i]);
    dayCell.appendChild(dateDiv);
    const ul = document.createElement('ul');
    ul.className = 'task-list';
    const dayStr = formatDateForKey(weekDates[i]);
    const dayTasks = tasks.filter(t => t.date === dayStr);
    dayTasks.sort(sortTasks);
    for (const task of dayTasks) {
      ul.appendChild(buildTaskLi(task));
    }
    dayCell.addEventListener('click', (e) => {
      if (
        e.target.classList.contains('task-item') ||
        e.target.classList.contains('checkbox-custom') ||
        e.target.classList.contains('cancel-btn')
      ) return;
      taskDate.value = formatDateForKey(weekDates[i]);
    });
    dayCell.appendChild(ul);
    weekRow.appendChild(dayCell);
  }
  calendar.appendChild(weekRow);
}

function showMonthView() {
  const now = new Date(today.getFullYear(), today.getMonth() + weekOffset, 1);
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOffset = start.getDay();
  const gridDays = [];
  let d = new Date(start);
  d.setDate(d.getDate() - startOffset);
  for (let i = 0; i < 42; i++) {
    gridDays.push(new Date(d.getTime()));
    d.setDate(d.getDate() + 1);
  }
  const monthGrid = document.createElement('div');
  monthGrid.className = 'month-grid';
  for (let i = 0; i < 7; i++) {
    const dayHeader = document.createElement('div');
    dayHeader.className = 'month-day-header';
    dayHeader.textContent = WEEK_DAYS[i];
    monthGrid.appendChild(dayHeader);
  }
  for (let i = 0; i < gridDays.length; i++) {
    const day = gridDays[i];
    const dayCell = document.createElement('div');
    dayCell.className = 'month-day';
    if (isToday(day)) {
      dayCell.classList.add('today');
    }
    dayCell.style.background = (day.getMonth() === now.getMonth()) ? '#f7fbff' : '#f0f5fa';
    addDropTargetEvents(dayCell, formatDateForKey(day));
    const dayHead = document.createElement('div');
    dayHead.className = 'month-day-header';
    dayHead.textContent = day.getDate();
    dayCell.appendChild(dayHead);
    const ul = document.createElement('ul');
    ul.className = 'task-list';
    const dayStr = formatDateForKey(day);
    let dayTasks = tasks.filter(t => t.date === dayStr);
    dayTasks.sort(sortTasks);
    for (const task of dayTasks) {
      ul.appendChild(buildTaskLi(task));
    }
    dayCell.appendChild(ul);
    if (day.getMonth() === now.getMonth()) {
      dayCell.addEventListener('click', (e) => {
        if (
          e.target.classList.contains('task-item') ||
          e.target.classList.contains('checkbox-custom') ||
          e.target.classList.contains('cancel-btn')
        ) return;
        taskDate.value = formatDateForKey(day);
      });
    }
    monthGrid.appendChild(dayCell);
  }
  calendar.appendChild(monthGrid);
  viewTitle.textContent = `${now.getFullYear()}年 ${now.getMonth() + 1}月`;
}

let draggedTask = null;

function buildTaskLi(task) {
  const li = document.createElement('li');
  li.className = 'task-item';
  li.setAttribute('data-priority', task.priority);
  li.setAttribute('draggable', 'true');
  li.addEventListener('dragstart', function (e) {
    draggedTask = task;
    li.classList.add('dragging');
    setTimeout(() => li.classList.remove('dragging'), 200);
  });
  li.addEventListener('dragend', function () {
    draggedTask = null;
    document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
  });
  const controls = document.createElement('div');
  controls.className = 'task-controls';
  // チェックボックス
  const checkbox = document.createElement('div');
  checkbox.className = `checkbox-custom${task.completed ? ' checked' : ''}`;
  checkbox.tabIndex = 0;
  checkbox.setAttribute('aria-label', '完了');
  checkbox.addEventListener('click', (e) => {
    firebase.database().ref('tasks').child(task.id).update({ completed: !task.completed });
  });
  controls.appendChild(checkbox);

  // 削除ボタン
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'cancel-btn';
  cancelBtn.title = "削除";
  cancelBtn.type = "button";
  cancelBtn.innerHTML = '×';
  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    firebase.database().ref('tasks').child(task.id).remove();
  });
  controls.appendChild(cancelBtn);

  li.appendChild(controls);

  const textSpan = document.createElement('span');
  textSpan.textContent = task.text;
  li.appendChild(textSpan);
  if (task.completed) li.classList.add('completed');
  return li;
}

function addDropTargetEvents(dayCell, targetDate) {
  dayCell.addEventListener('dragover', e => {
    e.preventDefault();
    if (!dayCell.classList.contains('drop-target')) dayCell.classList.add('drop-target');
  });
  dayCell.addEventListener('dragleave', e => {
    dayCell.classList.remove('drop-target');
  });
  dayCell.addEventListener('drop', e => {
    dayCell.classList.remove('drop-target');
    if (draggedTask && draggedTask.date !== targetDate) {
      firebase.database().ref('tasks/' + draggedTask.id + '/date').set(targetDate);
    }
  });
}

function setProgressBar() {
  let total = 0, done = 0;
  let dateSet = new Set();
  if (currentViewMode === 'week') {
    const now = new Date(today.getTime());
    now.setDate(now.getDate() + weekOffset * 7);
    const weekStart = new Date(now.getTime());
    weekStart.setDate(now.getDate() - now.getDay());
    for (let i = 0; i < 7; ++i) {
      let d = new Date(weekStart.getTime());
      d.setDate(weekStart.getDate() + i);
      dateSet.add(formatDateForKey(d));
    }
  } else {
    const now = new Date(today.getFullYear(), today.getMonth() + weekOffset, 1);
    const targetMonth = now.getMonth();
    for (let d = 1; d <= 31; d++) {
      let day = new Date(now.getFullYear(), targetMonth, d);
      if (day.getMonth() !== targetMonth) break;
      dateSet.add(formatDateForKey(day));
    }
  }
  for (const t of tasks) {
    if (dateSet.has(t.date)) {
      total++;
      if (t.completed) done++;
    }
  }
  let html = '';
  if (total === 0) {
    html = `<div class="progress-summary">タスクがありません</div>`;
    document.querySelector('.progress-bar-fill').style.width = `0%`;
  } else {
    const percent = Math.round((done / total) * 100);
    html = `<div class="progress-summary">進捗: ${done}/${total} (${percent}%)</div>`;
    document.querySelector('.progress-bar-fill').style.width = `${percent}%`;
  }
  progressBarBox.querySelector('.progress-summary').innerHTML = html;
}

function formatDate(date) {
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}
function formatDateYMD(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
function formatDateForKey(date) {
  const y = date.getFullYear();
  const m = ('0' + (date.getMonth() + 1)).slice(-2);
  const d = ('0' + date.getDate()).slice(-2);
  return `${y}-${m}-${d}`;
}
function isToday(date) {
  const todayStr = formatDateForKey(new Date());
  const dateStr = formatDateForKey(date);
  return todayStr === dateStr;
}
function sortTasks(a, b) {
  const priorityOrder = { '高': 1, '中': 2, '低': 3 };
  return priorityOrder[a.priority] - priorityOrder[b.priority];
}

// 初期表示
showCalendar();
showMemo();
loadTasks();
