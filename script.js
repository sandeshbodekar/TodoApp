(function () {
  'use strict';

  // STATE & PERSISTENCE (localStorage)
 
  const STORAGE_KEY = 'todo-app-tasks-v1';

  /** @type {{id: string, text: string, completed: boolean, createdAt: number}[]} */
  let tasks = loadTasks();
  let currentFilter = 'all'; // 'all' | |  active | | completed
  let editingId = null;      // id of the task currently being edited

  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error('Failed to read tasks from localStorage:', err);
      return [];
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      flashSaved();
    } catch (err) {
      console.error('Failed to save tasks to localStorage:', err);
    }
  }

  let saveTimer = null;
  function flashSaved() {
    const el = document.getElementById('saveIndicator');
    el.classList.add('show');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => el.classList.remove('show'), 900);
  }

  function generateId() {
    return (crypto.randomUUID && crypto.randomUUID()) ||
      Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

   
  // CRUD OPERATIONS — every mutation re-renders and re-saves
   
  function addTask(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    tasks.push({ id: generateId(), text: trimmed, completed: false, createdAt: Date.now() });
    saveTasks();
    render();
  }

  function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    task.completed = !task.completed;
    saveTasks();
    render();
  }

  function editTaskText(id, newText) {
    const trimmed = newText.trim();
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    if (trimmed) {
      task.text = trimmed;
      saveTasks();
    }
    editingId = null;
    render();
  }

  function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
    render();
  }

  function clearCompleted() {
    tasks = tasks.filter(t => !t.completed);
    saveTasks();
    render();
  }

   
  // FILTERING (derived view — never mutates `tasks` itself)
   
  function getFilteredTasks() {
    if (currentFilter === 'active') return tasks.filter(t => !t.completed);
    if (currentFilter === 'completed') return tasks.filter(t => t.completed);
    return tasks;
  }

   
  // DOM RENDERING — builds elements with createElement/textContent
  // (never innerHTML for task text, to avoid injecting raw HTML)
   
  const taskListEl = document.getElementById('taskList');

  function render() {
    const filtered = getFilteredTasks();
    taskListEl.innerHTML = ''; // clear only the list container, safe (no user content here)

    if (filtered.length === 0) {
      taskListEl.appendChild(buildEmptyState());
    } else {
      filtered.forEach((task, index) => {
        taskListEl.appendChild(buildTaskRow(task, index));
      });
    }

    updateTabCounts();
    updateStatusBar();
  }

  function buildEmptyState() {
    const li = document.createElement('li');
    li.className = 'empty-state';
    const messages = {
      all: '// no tasks yet — add one above to get started.',
      active: "// nothing active — you're all caught up.",
      completed: '// nothing completed yet.'
    };
    li.textContent = messages[currentFilter];
    return li;
  }

  function buildTaskRow(task, index) {
    const li = document.createElement('li');
    li.className = 'task' + (task.completed ? ' done' : '');
    li.dataset.id = task.id;

    const lineNo = document.createElement('span');
    lineNo.className = 'line-no';
    lineNo.textContent = String(index + 1).padStart(3, '0');

    const checkbox = document.createElement('button');
    checkbox.className = 'checkbox';
    checkbox.setAttribute('aria-label', task.completed ? 'mark as active' : 'mark as complete');

    li.appendChild(lineNo);
    li.appendChild(checkbox);

    if (editingId === task.id) {
      const input = document.createElement('input');
      input.className = 'edit-input';
      input.type = 'text';
      input.value = task.text;
      input.maxLength = 200;
      li.appendChild(input);
      // focus after it's in the DOM
      requestAnimationFrame(() => { input.focus(); input.select(); });
    } else {
      const span = document.createElement('span');
      span.className = 'task-text';
      span.tabIndex = 0;
      span.textContent = task.text; // textContent, not innerHTML — safe from HTML injection
      li.appendChild(span);
    }

    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.setAttribute('aria-label', 'delete task');
    del.textContent = '×';
    li.appendChild(del);

    return li;
  }

  function updateTabCounts() {
    document.getElementById('countAll').textContent = tasks.length;
    document.getElementById('countActive').textContent = tasks.filter(t => !t.completed).length;
    document.getElementById('countCompleted').textContent = tasks.filter(t => t.completed).length;
  }

  function updateStatusBar() {
    const left = tasks.filter(t => !t.completed).length;
    document.getElementById('itemsLeft').textContent =
      `${left} item${left === 1 ? '' : 's'} left`;

    const clearBtn = document.getElementById('clearCompleted');
    const hasCompleted = tasks.some(t => t.completed);
    clearBtn.disabled = !hasCompleted;
  }

     
  // EVENT HANDLING — delegated listeners (one listener per
  // container, not one per row) so dynamically added/removed
  // rows work automatically with no extra wiring.
     

  // --- Composer: add a task ---
  const inputEl = document.getElementById('taskInput');
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      addTask(inputEl.value);
      inputEl.value = '';
    }
  });

  // --- Filter tabs (delegated) ---
  document.getElementById('filterTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    currentFilter = btn.dataset.filter;
    document.querySelectorAll('.tab-btn').forEach(b =>
      b.classList.toggle('active', b === btn)
    );
    render();
  });

  // --- Task list clicks: toggle complete / delete (delegated) ---
  taskListEl.addEventListener('click', (e) => {
    const li = e.target.closest('.task');
    if (!li) return;
    const id = li.dataset.id;

    if (e.target.closest('.checkbox')) {
      toggleTask(id);
    } else if (e.target.closest('.delete-btn')) {
      deleteTask(id);
    }
  });

  // --- Task list double-click: enter edit mode (delegated) ---
  taskListEl.addEventListener('dblclick', (e) => {
    const textEl = e.target.closest('.task-text');
    if (!textEl) return;
    const li = e.target.closest('.task');
    editingId = li.dataset.id;
    render();
  });

  // --- Edit input: commit on Enter/blur, cancel on Escape (delegated) ---
  taskListEl.addEventListener('keydown', (e) => {
    if (!e.target.matches('.edit-input')) return;
    const li = e.target.closest('.task');
    if (e.key === 'Enter') {
      editTaskText(li.dataset.id, e.target.value);
    } else if (e.key === 'Escape') {
      editingId = null;
      render();
    }
  });

  taskListEl.addEventListener('blur', (e) => {
    if (!e.target.matches('.edit-input')) return;
    const li = e.target.closest('.task');
    if (li && editingId === li.dataset.id) {
      editTaskText(li.dataset.id, e.target.value);
    }
  }, true); // capture phase, since blur doesn't bubble

  // --- Clear completed ---
  document.getElementById('clearCompleted').addEventListener('click', clearCompleted);

    
  // INITialization.
     
  render();
  inputEl.focus();
})();
