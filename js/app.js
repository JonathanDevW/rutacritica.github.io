// Datos del proyecto
let tasks = [];
let criticalPath = [];
let projectDuration = 0;
let editingTaskId = null;
let timeUnit = "days";
let zoomLevel = 1.0;
let panOffset = { x: 0, y: 0 };
let isPanning = false;
let lastMousePosition = { x: 0, y: 0 };

// Elementos DOM
const taskNameInput = document.getElementById('task-name');
const taskDurationInput = document.getElementById('task-duration');
const dependenciesChecklist = document.getElementById('dependencies-checklist');
const addTaskBtn = document.getElementById('add-task');
const calculateBtn = document.getElementById('calculate-cpm');
const resetBtn = document.getElementById('reset-project');
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const resetViewBtn = document.getElementById('reset-view');
const timeUnitSelect = document.getElementById('time-unit');
const tasksBody = document.getElementById('tasks-body');
const criticalPathContainer = document.getElementById('critical-path');
const totalDurationEl = document.getElementById('total-duration');
const criticalTasksEl = document.getElementById('critical-tasks');
const nonCriticalTasksEl = document.getElementById('non-critical-tasks');
const minSlackEl = document.getElementById('min-slack');
const canvas = document.getElementById('cpm-canvas');
const ctx = canvas.getContext('2d');

// Event Listeners
addTaskBtn.addEventListener('click', addTask);
calculateBtn.addEventListener('click', calculateCPM);
resetBtn.addEventListener('click', resetProject);
zoomInBtn.addEventListener('click', () => { zoomLevel *= 1.2; drawNetworkDiagram(); });
zoomOutBtn.addEventListener('click', () => { zoomLevel /= 1.2; drawNetworkDiagram(); });
resetViewBtn.addEventListener('click', () => { zoomLevel = 1.0; panOffset = { x: 0, y: 0 }; drawNetworkDiagram(); });
timeUnitSelect.addEventListener('change', updateTimeUnit);

// Eventos para desplazamiento del diagrama
canvas.addEventListener('mousedown', (e) => {
    isPanning = true;
    lastMousePosition = { x: e.clientX, y: e.clientY };
    canvas.style.cursor = 'grabbing';
});

canvas.addEventListener('mousemove', (e) => {
    if (isPanning) {
        panOffset.x += (e.clientX - lastMousePosition.x) / zoomLevel;
        panOffset.y += (e.clientY - lastMousePosition.y) / zoomLevel;
        lastMousePosition = { x: e.clientX, y: e.clientY };
        drawNetworkDiagram();
    }
});

canvas.addEventListener('mouseup', () => {
    isPanning = false;
    canvas.style.cursor = 'grab';
});

canvas.addEventListener('mouseleave', () => {
    isPanning = false;
    canvas.style.cursor = 'default';
});

// Actualizar unidad de tiempo
function updateTimeUnit() {
    timeUnit = timeUnitSelect.value;
    const unitLabels = {
        hours: "horas",
        days: "días",
        weeks: "semanas",
        months: "meses",
        years: "años"
    };
    
    // Actualizar todas las unidades en la interfaz
    document.querySelectorAll('[data-time-unit]').forEach(el => {
        el.textContent = unitLabels[timeUnit];
    });
    
    if (tasks.length > 0) {
        renderTaskTable();
        drawNetworkDiagram();
    }
}

// Añadir o editar tarea
function addTask() {
    const name = taskNameInput.value.trim();
    const duration = parseInt(taskDurationInput.value);
    const dependencies = document.getElementById('task-dependencies').value
        .split(',')
        .map(id => id.trim())
        .filter(id => id !== '');

    if (!name) {
        showError('Por favor ingresa un nombre válido para la tarea.');
        return;
    }

    if (isNaN(duration) || duration <= 0) {
        showError('Por favor ingresa una duración válida mayor a cero.');
        return;
    }

    if (editingTaskId !== null) {
        // Modo edición
        const taskIndex = tasks.findIndex(t => t.id === editingTaskId);
        if (taskIndex !== -1) {
            tasks[taskIndex] = {
                ...tasks[taskIndex],
                name,
                duration,
                dependencies
            };
        }
        editingTaskId = null;
        addTaskBtn.innerHTML = '<i class="fas fa-plus"></i> Agregar Tarea';
    } else {
        // Nueva tarea
        tasks.push({
            id: name,
            name,
            duration,
            dependencies,
            es: 0,
            ef: 0,
            ls: 0,
            lf: 0,
            slack: 0,
            isCritical: false
        });
    }

    renderTaskTable();
    resetForm();
    updateWizard(1); // Avanzar al paso 2
}

// Mostrar mensaje de error
function showError(message) {
    let errorEl = document.querySelector('.error-message');
    if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.className = 'error-message';
        document.querySelector('.card').insertBefore(errorEl, document.querySelector('.quick-actions'));
    }
    errorEl.textContent = message;
    setTimeout(() => {
        errorEl.style.opacity = '0';
        setTimeout(() => {
            errorEl.remove();
        }, 500);
    }, 3000);
}

// Limpiar formulario
function resetForm() {
    taskNameInput.value = '';
    taskDurationInput.value = '';
    document.getElementById('task-dependencies').value = '';
    taskNameInput.focus();
}

// Renderizar la tabla de tareas con badges
function renderTaskTable() {
    tasksBody.innerHTML = '';
    tasks.forEach(task => {
        const row = document.createElement('tr');
        if (task.isCritical) {
            row.classList.add('table-danger');
        }

        row.innerHTML = `
            <td>${task.id}</td>
            <td>${task.name}</td>
            <td>
                <span class="badge bg-primary">${task.duration}</span>
            </td>
            <td>
                ${task.dependencies.map(dep => `<span class="badge bg-secondary me-1">${dep}</span>`).join('') || '-'}
            </td>
            <td>${task.es}</td>
            <td>${task.ef}</td>
            <td>${task.ls}</td>
            <td>${task.lf}</td>
            <td>
                <span class="badge ${task.slack === 0 ? 'bg-danger' : 'bg-warning text-dark'}">
                    ${task.slack}
                </span>
            </td>
            <td>
                <span class="badge ${task.isCritical ? 'bg-danger' : 'bg-success'}">
                    ${task.isCritical ? 'Crítica' : 'No crítica'}
                </span>
            </td>
            <td>
                <button onclick="editTask('${task.id}')" class="btn btn-sm btn-outline-primary me-1">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteTask('${task.id}')" class="btn btn-sm btn-outline-danger">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tasksBody.appendChild(row);
    });
}

// Editar tarea
function editTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        editingTaskId = taskId;
        taskNameInput.value = task.name;
        taskDurationInput.value = task.duration;
        document.getElementById('task-dependencies').value = task.dependencies.join(', ');
        addTaskBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
        taskNameInput.focus();
        updateWizard(1); // Volver al paso de agregar tareas
    }
}

// Eliminar tarea
function deleteTask(taskId) {
    if (confirm('¿Estás seguro de eliminar esta tarea?')) {
        tasks = tasks.filter(task => task.id !== taskId);
        // Eliminar esta tarea de las dependencias de otras tareas
        tasks.forEach(task => {
            task.dependencies = task.dependencies.filter(dep => dep !== taskId);
        });
        renderTaskTable();
        if (editingTaskId === taskId) {
            resetForm();
            editingTaskId = null;
            addTaskBtn.innerHTML = '<i class="fas fa-plus"></i> Agregar Tarea';
        }
    }
}

// Reiniciar proyecto
function resetProject() {
    if (confirm('¿Estás seguro de reiniciar el proyecto? Se perderán todos los datos.')) {
        tasks = [];
        criticalPath = [];
        projectDuration = 0;
        editingTaskId = null;
        renderTaskTable();
        resetForm();
        totalDurationEl.textContent = '0 días';
        criticalTasksEl.textContent = '0';
        nonCriticalTasksEl.textContent = '0';
        minSlackEl.textContent = '0 días';
        criticalPathContainer.innerHTML = '';
        drawNetworkDiagram();
        updateWizard(0); // Volver al paso 1
    }
}

// Calcular ruta crítica
function calculateCPM() {
    if (tasks.length === 0) {
        showError('Agrega al menos una tarea para calcular la ruta crítica.');
        return;
    }

    // Mostrar indicador de carga
    const originalText = calculateBtn.innerHTML;
    calculateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Calculando...';
    calculateBtn.disabled = true;

    // Ejecutar en tiempo diferido para no bloquear la UI
    setTimeout(() => {
        try {
            // Resetear valores
            tasks.forEach(task => {
                task.es = 0;
                task.ef = 0;
                task.ls = Infinity;
                task.lf = Infinity;
                task.slack = 0;
                task.isCritical = false;
            });

            // 1. Forward Pass
            const sortedTasks = topologicalSort();
            if (!sortedTasks) return;

            for (const task of sortedTasks) {
                if (task.dependencies.length === 0) {
                    task.es = 0;
                } else {
                    let maxEF = 0;
                    for (const depId of task.dependencies) {
                        const dep = tasks.find(t => t.id === depId);
                        if (dep && dep.ef > maxEF) maxEF = dep.ef;
                    }
                    task.es = maxEF;
                }
                task.ef = task.es + task.duration;
            }

            // Duración total del proyecto
            projectDuration = Math.max(...tasks.map(task => task.ef));
            totalDurationEl.textContent = `${projectDuration} ${timeUnitSelect.options[timeUnitSelect.selectedIndex].text.toLowerCase()}`;

            // 2. Backward Pass
            const reverseOrder = [...sortedTasks].reverse();
            for (const task of reverseOrder) {
                // Encontrar sucesores
                const successors = tasks.filter(t => t.dependencies.includes(task.id));

                if (successors.length === 0) {
                    task.lf = projectDuration;
                } else {
                    let minLS = Infinity;
                    for (const succ of successors) {
                        if (succ.ls < minLS) minLS = succ.ls;
                    }
                    task.lf = minLS;
                }
                task.ls = task.lf - task.duration;
            }

            // 3. Calcular holgura y ruta crítica
            let criticalTasks = 0;
            let nonCriticalTasks = 0;
            let minSlack = Infinity;

            tasks.forEach(task => {
                task.slack = task.ls - task.es;
                task.isCritical = task.slack === 0;

                if (task.isCritical) criticalTasks++;
                else nonCriticalTasks++;

                if (task.slack < minSlack) minSlack = task.slack;
            });

            criticalTasksEl.textContent = criticalTasks;
            nonCriticalTasksEl.textContent = nonCriticalTasks;
            minSlackEl.textContent = `${minSlack} ${timeUnitSelect.options[timeUnitSelect.selectedIndex].text.toLowerCase()}`;

            identifyCriticalPath();
            renderTaskTable();
            drawNetworkDiagram();
            updateWizard(4); // Avanzar al paso de resultados

        } catch (error) {
            console.error("Error en CPM:", error);
            showError('Error en cálculo: ' + error.message);
        } finally {
            // Restaurar botón
            calculateBtn.innerHTML = originalText;
            calculateBtn.disabled = false;
        }
    }, 100);
}

// Ordenamiento topológico (Kahn's Algorithm)
function topologicalSort() {
    // 1. Crear mapa de dependencias
    const inDegree = {};
    const graph = {};
    const queue = [];
    const result = [];

    // Inicializar estructuras
    tasks.forEach(task => {
        inDegree[task.id] = 0;
        graph[task.id] = [];
    });

    // Construir grafo
    tasks.forEach(task => {
        for (const depId of task.dependencies) {
            if (tasks.some(t => t.id === depId)) {
                graph[depId].push(task.id);
                inDegree[task.id]++;
            }
        }
    });

    // 2. Encontrar nodos iniciales (sin dependencias)
    for (const task of tasks) {
        if (inDegree[task.id] === 0) {
            queue.push(task.id);
        }
    }

    // 3. Procesar nodos
    while (queue.length > 0) {
        const node = queue.shift();
        result.push(node);

        for (const neighbor of graph[node]) {
            inDegree[neighbor]--;
            if (inDegree[neighbor] === 0) {
                queue.push(neighbor);
            }
        }
    }

    // 4. Verificar si hay ciclo
    if (result.length !== tasks.length) {
        showError('Existe un ciclo en las dependencias. Corrígelas para continuar.');
        return null;
    }

    // Convertir IDs a objetos de tareas
    return result.map(id => tasks.find(t => t.id === id));
}

// Identificar la ruta crítica
// Identificar la ruta crítica con badges
function identifyCriticalPath() {
    criticalPath = [];
    const criticalTasks = tasks.filter(task => task.isCritical);
    criticalTasks.sort((a, b) => b.ef - a.ef);

    let currentTask = criticalTasks[0];
    criticalPath.push(currentTask);

    while (currentTask.dependencies.length > 0) {
        for (const depId of currentTask.dependencies) {
            const depTask = criticalTasks.find(t => t.id === depId);
            if (depTask && depTask.isCritical) {
                criticalPath.push(depTask);
                currentTask = depTask;
                break;
            }
        }
    }

    criticalPath.reverse();
    criticalPathContainer.innerHTML = '';

    criticalPath.forEach((task, index) => {
        const badge = document.createElement('span');
        badge.className = 'badge bg-danger me-2 p-2';
        badge.innerHTML = `
            <i class="fas fa-tasks me-1"></i>
            ${task.id} (${task.duration} ${timeUnitSelect.options[timeUnitSelect.selectedIndex].text.toLowerCase()})
        `;
        criticalPathContainer.appendChild(badge);
        
        if (index < criticalPath.length - 1) {
            const arrow = document.createElement('span');
            arrow.className = 'text-danger mx-2';
            arrow.innerHTML = '<i class="fas fa-arrow-right"></i>';
            criticalPathContainer.appendChild(arrow);
        }
    });
}

// Dibujar diagrama de red
function drawNetworkDiagram() {
    // Ajustar tamaño del canvas
    resizeCanvas();

    // Limpiar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Si no hay tareas, mostrar mensaje
    if (tasks.length === 0) {
        ctx.fillStyle = '#999';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Agrega tareas para visualizar el diagrama', canvas.width / 2, canvas.height / 2);
        return;
    }

    // Configuración del diagrama
    const nodeRadius = 30;
    const horizontalSpacing = 150;
    const verticalSpacing = 100;

    // Organizar tareas en niveles (por ES)
    const levels = {};
    tasks.forEach(task => {
        if (!levels[task.es]) {
            levels[task.es] = [];
        }
        levels[task.es].push(task);
    });

    // Calcular posiciones
    const nodePositions = {};
    let maxNodesInLevel = 0;
    const levelKeys = Object.keys(levels).sort((a, b) => a - b);
    levelKeys.forEach((key, levelIndex) => {
        const levelTasks = levels[key];
        maxNodesInLevel = Math.max(maxNodesInLevel, levelTasks.length);
        levelTasks.forEach((task, taskIndex) => {
            const x = 100 + levelIndex * horizontalSpacing;
            const y = 100 + taskIndex * verticalSpacing;
            nodePositions[task.id] = { x, y, task };
        });
    });

    // Aplicar transformaciones de zoom y desplazamiento
    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoomLevel, zoomLevel);

    // Dibujar conexiones
    tasks.forEach(task => {
        task.dependencies.forEach(depId => {
            const depTask = tasks.find(t => t.id === depId);
            if (depTask && nodePositions[task.id] && nodePositions[depId]) {
                const startX = nodePositions[depId].x;
                const startY = nodePositions[depId].y;
                const endX = nodePositions[task.id].x;
                const endY = nodePositions[task.id].y;

                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.strokeStyle = task.isCritical && depTask.isCritical ? '#e74c3c' : '#3498db';
                ctx.lineWidth = task.isCritical && depTask.isCritical ? 3 : 1;
                ctx.stroke();

                // Flecha
                const angle = Math.atan2(endY - startY, endX - startX);
                const arrowLength = 10;
                ctx.beginPath();
                ctx.moveTo(endX, endY);
                ctx.lineTo(
                    endX - arrowLength * Math.cos(angle - Math.PI / 6),
                    endY - arrowLength * Math.sin(angle - Math.PI / 6)
                );
                ctx.lineTo(
                    endX - arrowLength * Math.cos(angle + Math.PI / 6),
                    endY - arrowLength * Math.sin(angle + Math.PI / 6)
                );
                ctx.closePath();
                ctx.fillStyle = task.isCritical && depTask.isCritical ? '#e74c3c' : '#3498db';
                ctx.fill();
            }
        });
    });

    // Dibujar nodos
    for (const id in nodePositions) {
        const { x, y, task } = nodePositions[id];
        ctx.beginPath();
        ctx.arc(x, y, nodeRadius, 0, Math.PI * 2);
        ctx.fillStyle = task.isCritical ? 'rgba(231, 76, 60, 0.8)' : 'rgba(46, 204, 113, 0.8)';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Texto
        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(task.id, x, y - 5);
        ctx.font = '12px Arial';
        ctx.fillText(`${task.duration} ${timeUnitSelect.options[timeUnitSelect.selectedIndex].text.toLowerCase()}`, x, y + 15);
    }

    ctx.restore();
}

// Ajustar tamaño del canvas
function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
}

// Actualizar wizard
function updateWizard(currentStep) {
    const steps = document.querySelectorAll('.wizard-step');
    const progressBar = document.getElementById('progress-bar');

    steps.forEach((step, index) => {
        if (index < currentStep) {
            step.classList.add('completed');
            step.classList.remove('active');
        } else if (index === currentStep) {
            step.classList.add('active');
            step.classList.remove('completed');
        } else {
            step.classList.remove('active', 'completed');
        }
    });

    // Actualizar barra de progreso
    const progress = (currentStep / (steps.length - 1)) * 100;
    progressBar.style.width = `${progress}%`;
}

// Inicialización
function init() {
    renderTaskTable();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    drawNetworkDiagram();
}

init();