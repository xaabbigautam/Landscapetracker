// Database configuration
const DB_NAME = 'LandscapingTaskDB';
const DB_VERSION = 3;
let db;
let currentUser = null;
let userRole = '';
let currentTaskToAssign = null;

// Team members data
const teamMembers = {
    'subash@teamlead.com': {
        name: 'Subash Rai',
        password: 'Subash@866',
        zone: 'Downtown',
        role: 'team',
        department: 'Landscaping',
        is_active: true,
        is_hardcoded: true
    },
    'pawan@teamlead.com': {
        name: 'Pawan Koirala',
        password: 'Pawan@592',
        zone: 'Areesh/Green Team/PODs Indoor',
        role: 'team',
        department: 'Maintenance',
        is_active: true,
        is_hardcoded: true
    },
    'sujan@teamlead.com': {
        name: 'Sujan Subedi',
        password: 'Sujan@576',
        zone: 'MUD IP',
        role: 'team',
        department: 'Irrigation',
        is_active: true,
        is_hardcoded: true
    },
    'saroj@teamlead.com': {
        name: 'Saroj Pokhrel',
        password: 'Saroj@511',
        zone: 'PODs/VIP/RC/gate 5',
        role: 'team',
        department: 'VIP Services',
        is_active: true,
        is_hardcoded: true
    },
    'taraknath@teamlead.com': {
        name: 'Taraknath Sharma',
        password: 'Tarak@593',
        zone: 'Golf Landscaping',
        role: 'team',
        department: 'Golf Course',
        is_active: true,
        is_hardcoded: true
    },
    'ghadindra@teamlead.com': {
        name: 'Ghadindra Chaulagain',
        password: 'Ghadin@570',
        zone: 'Irrigation MUD/IP/POD/GATE 5',
        role: 'team',
        department: 'Irrigation',
        is_active: true,
        is_hardcoded: true
    },
    'shambhu@teamlead.com': {
        name: 'Shambhu Kumar Sah',
        password: 'Shambhu@506',
        zone: 'Irrigation Areesh/Downtown',
        role: 'team',
        department: 'Irrigation',
        is_active: true,
        is_hardcoded: true
    },
    'sunil@teamlead.com': {
        name: 'Sunil Kumar Sah Sudi',
        password: 'Sunil@583',
        zone: 'Palm Trees',
        role: 'team',
        department: 'Irrigation',
        is_active: true,
        is_hardcoded: true
    }
};

// Admin credentials
const adminCredentials = {
    'admin@landscape.com': {
        password: 'Landscape@2025',
        name: 'System Admin',
        role: 'system_admin',
        is_active: true,
        is_hardcoded: true
    },
    'victor@landscape.com': {
        password: 'Vic123',
        name: 'Victor AM',
        role: 'admin',
        is_active: true,
        is_hardcoded: true
    },
    'james@landscape.com': {
        password: 'Manager2025',
        name: 'James Manager',
        role: 'admin',
        is_active: true,
        is_hardcoded: true,
        is_special_approver: true
    },
    'mike@landscape.com': {
        password: 'Michael123',
        name: 'Mike AM',
        role: 'admin',
        is_active: true,
        is_hardcoded: true
    },
    'chhabi@landscape.com': {
        password: 'Admin@2025',
        name: 'Chhabi Admin',
        role: 'system_admin',
        is_active: true,
        is_hardcoded: true
    }
};

// Task statuses
const TASK_STATUS = {
    PENDING: 'Pending',
    APPROVED: 'Approved',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    REJECTED: 'Rejected'
};

// Priority levels
const PRIORITY = {
    NORMAL: 'Normal',
    HIGH: 'High',
    URGENT: 'Urgent'
};

// Special approval role for James
const SPECIAL_APPROVER_EMAIL = 'james@landscape.com';

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initDatabase();
    setupEventListeners();
    checkAuth();
});

// Initialize IndexedDB
function initDatabase() {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = function(event) {
        console.error("Database error:", event.target.error);
        showNotification("Database error! Using fallback storage.", "error");
    };

    request.onupgradeneeded = function(event) {
        db = event.target.result;
        const oldVersion = event.oldVersion;
        
        // Create tasks store if it doesn't exist
        if (!db.objectStoreNames.contains('tasks')) {
            const taskStore = db.createObjectStore('tasks', { keyPath: 'id', autoIncrement: true });
            taskStore.createIndex('status', 'status', { unique: false });
            taskStore.createIndex('assignedTo', 'assignedTo', { unique: false });
            taskStore.createIndex('createdBy', 'createdBy', { unique: false });
            taskStore.createIndex('zone', 'zone', { unique: false });
            taskStore.createIndex('priority', 'priority', { unique: false });
            taskStore.createIndex('isAdminRequest', 'isAdminRequest', { unique: false });
            taskStore.createIndex('isVisibleToAll', 'isVisibleToAll', { unique: false });
        }
        
        // Create users store
        if (!db.objectStoreNames.contains('users')) {
            const userStore = db.createObjectStore('users', { keyPath: 'email' });
            userStore.createIndex('role', 'role', { unique: false });
            userStore.createIndex('status', 'is_active', { unique: false });
            userStore.createIndex('department', 'department', { unique: false });
        }
        
        // Create activity log store
        if (!db.objectStoreNames.contains('activityLog')) {
            const logStore = db.createObjectStore('activityLog', { keyPath: 'id', autoIncrement: true });
            logStore.createIndex('userId', 'userId', { unique: false });
            logStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        
        // Migrate existing data
        if (oldVersion < 3) {
            const transaction = request.transaction;
            const userStore = transaction.objectStore('users');
            
            // Add all team members
            Object.entries(teamMembers).forEach(([email, user]) => {
                userStore.put({ ...user, email });
            });
            
            // Add all admins
            Object.entries(adminCredentials).forEach(([email, admin]) => {
                userStore.put({ ...admin, email });
            });
        }
    };

    request.onsuccess = function(event) {
        db = event.target.result;
        console.log("Database initialized successfully");
        
        // Check if we need to seed data
        checkAndSeedData();
    };
}

// Check and seed data if needed
function checkAndSeedData() {
    const transaction = db.transaction(['users'], 'readonly');
    const userStore = transaction.objectStore('users');
    const countRequest = userStore.count();
    
    countRequest.onsuccess = function() {
        if (countRequest.result === 0) {
            // Database is empty, seed initial data
            seedInitialData();
        }
    };
}

// Seed initial data
function seedInitialData() {
    const transaction = db.transaction(['users'], 'readwrite');
    const userStore = transaction.objectStore('users');
    
    // Add team members
    Object.entries(teamMembers).forEach(([email, user]) => {
        userStore.put({ ...user, email });
    });
    
    // Add admins
    Object.entries(adminCredentials).forEach(([email, admin]) => {
        userStore.put({ ...admin, email });
    });
    
    showNotification("Initial data seeded successfully", "success");
}

// Setup event listeners
function setupEventListeners() {
    // Welcome screen buttons - FIXED: Use direct event listeners
    document.addEventListener('click', function(event) {
        const target = event.target;
        
        // Welcome screen buttons
        if (target.closest('#welcomeSection .team')) {
            showTeamLogin();
        } else if (target.closest('#welcomeSection .admin')) {
            showAdminLogin();
        }
        
        // Team login form
        else if (target.closest('#teamLoginSection .team')) {
            teamLogin();
        }
        
        // Admin login form
        else if (target.closest('#adminLoginSection .admin')) {
            adminLogin();
        }
        
        // Back buttons
        else if (target.closest('#teamLoginSection .small') || target.closest('#adminLoginSection .small')) {
            backToWelcome();
        }
        
        // Logout buttons
        else if (target.closest('#teamPortal .orange') || target.closest('#adminPortal .orange')) {
            if (target.textContent.includes('Logout') || target.querySelector('i.fa-sign-out-alt')) {
                logout();
            }
        }
        
        // Tab buttons
        else if (target.closest('.tab-btn')) {
            const tabBtn = target.closest('.tab-btn');
            const tabId = tabBtn.getAttribute('data-tab');
            if (tabId) {
                showTab(tabId);
            }
        }
        
        // Form submissions
        else if (target.closest('#request-task-team .submit')) {
            requestTask();
        } else if (target.closest('#create-task .submit')) {
            createTask();
        }
        
        // Modal close buttons
        else if (target.classList.contains('modal-close')) {
            if (target.closest('#taskModal')) {
                closeModal();
            } else if (target.closest('#assignTaskModal')) {
                closeAssignModal();
            } else if (target.closest('#addEmployeeModal')) {
                closeAddEmployeeModal();
            }
        }
    });
    
    // Enter key for logins
    document.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            if (!document.getElementById('teamLoginSection').classList.contains('hidden')) {
                teamLogin();
            } else if (!document.getElementById('adminLoginSection').classList.contains('hidden')) {
                adminLogin();
            }
        }
    });
    
    // Date range toggle
    const dateRange = document.getElementById('dateRange');
    if (dateRange) {
        dateRange.addEventListener('change', function(e) {
            const customRangeDiv = document.getElementById('customDateRange');
            if (e.target.value === 'custom') {
                customRangeDiv.classList.remove('hidden');
            } else {
                customRangeDiv.classList.add('hidden');
            }
        });
    }
    
    // Direct button event listeners for welcome screen
    const teamLoginBtn = document.querySelector('#welcomeSection .team');
    const adminLoginBtn = document.querySelector('#welcomeSection .admin');
    
    if (teamLoginBtn) {
        teamLoginBtn.addEventListener('click', showTeamLogin);
    }
    if (adminLoginBtn) {
        adminLoginBtn.addEventListener('click', showAdminLogin);
    }
}

// Show team login
function showTeamLogin() {
    hideAllSections();
    document.getElementById('teamLoginSection').classList.remove('hidden');
    setTimeout(() => {
        document.getElementById('teamEmail').focus();
        // Add direct event listener to team login button
        const teamLoginBtn = document.querySelector('#teamLoginSection .team');
        if (teamLoginBtn) {
            teamLoginBtn.addEventListener('click', teamLogin);
        }
    }, 100);
}

// Show admin login
function showAdminLogin() {
    hideAllSections();
    document.getElementById('adminLoginSection').classList.remove('hidden');
    setTimeout(() => {
        document.getElementById('adminEmail').focus();
        // Add direct event listener to admin login button
        const adminLoginBtn = document.querySelector('#adminLoginSection .admin');
        if (adminLoginBtn) {
            adminLoginBtn.addEventListener('click', adminLogin);
        }
    }, 100);
}

// Hide all sections
function hideAllSections() {
    document.getElementById('welcomeSection').classList.add('hidden');
    document.getElementById('teamLoginSection').classList.add('hidden');
    document.getElementById('adminLoginSection').classList.add('hidden');
    document.getElementById('teamPortal').classList.add('hidden');
    document.getElementById('adminPortal').classList.add('hidden');
}

// Back to welcome screen
function backToWelcome() {
    hideAllSections();
    document.getElementById('welcomeSection').classList.remove('hidden');
}

// Team login function
function teamLogin() {
    const email = document.getElementById('teamEmail').value.trim();
    const password = document.getElementById('teamPassword').value;
    
    if (!email || !password) {
        showNotification("Please enter email and password", "error");
        return;
    }
    
    // Check database for user
    const transaction = db.transaction(['users'], 'readonly');
    const userStore = transaction.objectStore('users');
    const request = userStore.get(email);
    
    request.onsuccess = function() {
        const user = request.result;
        
        if (!user) {
            showNotification("Team member not found!", "error");
            return;
        }
        
        if (user.role !== 'team') {
            showNotification("This is not a team member account!", "error");
            return;
        }
        
        if (user.password !== password) {
            showNotification("Invalid password!", "error");
            return;
        }
        
        if (!user.is_active) {
            showNotification("Account is deactivated!", "error");
            return;
        }
        
        // Set current user
        currentUser = {
            email: email,
            name: user.name,
            role: 'team',
            zone: user.zone || '',
            department: user.department || ''
        };
        
        // Store in localStorage
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        localStorage.setItem('userRole', 'team');
        
        showNotification(`Welcome ${currentUser.name}!`, "success");
        showTeamPortal();
    };
    
    request.onerror = function() {
        showNotification("Error accessing database", "error");
    };
}

// Admin login function
function adminLogin() {
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value;
    
    if (!email || !password) {
        showNotification("Please enter email and password", "error");
        return;
    }
    
    // Check database for user
    const transaction = db.transaction(['users'], 'readonly');
    const userStore = transaction.objectStore('users');
    const request = userStore.get(email);
    
    request.onsuccess = function() {
        const user = request.result;
        
        if (!user) {
            showNotification("Admin not found!", "error");
            return;
        }
        
        if (user.role === 'team') {
            showNotification("This is a team member account!", "error");
            return;
        }
        
        if (user.password !== password) {
            showNotification("Invalid password!", "error");
            return;
        }
        
        if (!user.is_active) {
            showNotification("Account is deactivated!", "error");
            return;
        }
        
        // Set current user
        currentUser = {
            email: email,
            name: user.name,
            role: user.role,
            is_special_approver: user.is_special_approver || false
        };
        
        // Store in localStorage
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        localStorage.setItem('userRole', user.role);
        
        showNotification(`Welcome ${currentUser.name}!`, "success");
        showAdminPortal();
    };
    
    request.onerror = function() {
        showNotification("Error accessing database", "error");
    };
}

// Show team portal
function showTeamPortal() {
    hideAllSections();
    document.getElementById('teamPortal').classList.remove('hidden');
    
    // Set up tab buttons
    setupTabButtons('teamPortal');
    
    document.getElementById('teamMemberName').textContent = currentUser.name;
    loadTeamProfile();
    loadAllTasksForTeam();
    loadMyTasks();
    
    // Set default tab
    showTab('all-tasks-team');
}

// Show admin portal
function showAdminPortal() {
    hideAllSections();
    document.getElementById('adminPortal').classList.remove('hidden');
    
    // Set up tab buttons
    setupTabButtons('adminPortal');
    
    document.getElementById('adminName').textContent = currentUser.name;
    
    // Set role badge
    const roleBadge = document.getElementById('adminRoleBadge');
    if (currentUser.role === 'system_admin') {
        roleBadge.textContent = 'System Admin';
        roleBadge.className = 'role-badge system-admin';
        const systemAdminAlert = document.getElementById('systemAdminAlert');
        if (systemAdminAlert) systemAdminAlert.classList.remove('hidden');
        // Show add employee button for system admin
        const addEmployeeBtn = document.getElementById('addEmployeeBtn');
        if (addEmployeeBtn) addEmployeeBtn.classList.remove('hidden');
    } else {
        roleBadge.textContent = 'Admin';
        roleBadge.className = 'role-badge admin';
        const systemAdminAlert = document.getElementById('systemAdminAlert');
        if (systemAdminAlert) systemAdminAlert.classList.add('hidden');
        // Hide add employee button for regular admins
        const addEmployeeBtn = document.getElementById('addEmployeeBtn');
        if (addEmployeeBtn) addEmployeeBtn.classList.add('hidden');
    }
    
    // Show special badge for James
    if (currentUser.email === SPECIAL_APPROVER_EMAIL) {
        roleBadge.textContent = 'Special Approver';
        roleBadge.className = 'role-badge special-approver';
        const jamesWarning = document.getElementById('jamesWarning');
        if (jamesWarning) jamesWarning.classList.remove('hidden');
    }
    
    // Load admin data
    loadAllTasksForAdmin();
    loadPendingApprovals();
    loadEmployees();
    populateAssignToDropdown();
    
    // Set default tab
    showTab('all-tasks-admin');
}

// Setup tab buttons with data attributes
function setupTabButtons(portalId) {
    const portal = document.getElementById(portalId);
    const tabButtons = portal.querySelectorAll('.tab-btn');
    
    tabButtons.forEach(button => {
        const text = button.textContent.toLowerCase();
        if (text.includes('all tasks')) {
            button.setAttribute('data-tab', portalId === 'teamPortal' ? 'all-tasks-team' : 'all-tasks-admin');
        } else if (text.includes('my tasks')) {
            button.setAttribute('data-tab', 'my-tasks');
        } else if (text.includes('request task') || text.includes('create task')) {
            button.setAttribute('data-tab', portalId === 'teamPortal' ? 'request-task-team' : 'create-task');
        } else if (text.includes('profile')) {
            button.setAttribute('data-tab', 'team-profile');
        } else if (text.includes('approvals')) {
            button.setAttribute('data-tab', 'approvals');
        } else if (text.includes('reports')) {
            button.setAttribute('data-tab', 'reports');
        } else if (text.includes('employees')) {
            button.setAttribute('data-tab', 'admin-employees');
        }
    });
}

// Show tab content
function showTab(tabId) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    const tabContent = document.getElementById(tabId);
    if (tabContent) {
        tabContent.classList.add('active');
        
        // Activate corresponding button
        const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
        
        // Load tab data
        switch(tabId) {
            case 'all-tasks-team':
                loadAllTasksForTeam();
                break;
            case 'all-tasks-admin':
                loadAllTasksForAdmin();
                break;
            case 'my-tasks':
                loadMyTasks();
                break;
            case 'approvals':
                loadPendingApprovals();
                break;
            case 'admin-employees':
                loadEmployees();
                break;
        }
    }
}

// Load all tasks for team members
function loadAllTasksForTeam() {
    const tasksList = document.getElementById('allTasksListTeam');
    if (!tasksList) return;
    
    tasksList.innerHTML = '<div class="loading"><i class="fas fa-spinner"></i><p>Loading all tasks...</p></div>';
    
    const transaction = db.transaction(['tasks'], 'readonly');
    const taskStore = transaction.objectStore('tasks');
    const request = taskStore.getAll();
    
    request.onsuccess = function() {
        const tasks = request.result;
        const visibleTasks = tasks.filter(task => task.isVisibleToAll !== false);
        displayTasks(visibleTasks, tasksList, true, false, true);
    };
    
    request.onerror = function() {
        tasksList.innerHTML = '<div class="card"><p>Error loading tasks</p></div>';
    };
}

// Load all tasks for admins
function loadAllTasksForAdmin() {
    const tasksList = document.getElementById('allTasksListAdmin');
    if (!tasksList) return;
    
    tasksList.innerHTML = '<div class="loading"><i class="fas fa-spinner"></i><p>Loading all tasks...</p></div>';
    
    const transaction = db.transaction(['tasks'], 'readonly');
    const taskStore = transaction.objectStore('tasks');
    const request = taskStore.getAll();
    
    request.onsuccess = function() {
        const tasks = request.result;
        const visibleTasks = tasks.filter(task => task.isVisibleToAll !== false);
        displayTasks(visibleTasks, tasksList, false, false, false);
    };
    
    request.onerror = function() {
        tasksList.innerHTML = '<div class="card"><p>Error loading tasks</p></div>';
    };
}

// Load team member's assigned tasks
function loadMyTasks() {
    const tasksList = document.getElementById('myTasksList');
    if (!tasksList) return;
    
    tasksList.innerHTML = '<div class="loading"><i class="fas fa-spinner"></i><p>Loading my tasks...</p></div>';
    
    const transaction = db.transaction(['tasks'], 'readonly');
    const taskStore = transaction.objectStore('tasks');
    const index = taskStore.index('assignedTo');
    const request = index.getAll(currentUser.email);
    
    request.onsuccess = function() {
        const tasks = request.result;
        if (tasks.length === 0) {
            tasksList.innerHTML = '<div class="card"><p>No tasks assigned to you yet.</p></div>';
            return;
        }
        displayTasks(tasks, tasksList, true, false, false);
    };
    
    request.onerror = function() {
        tasksList.innerHTML = '<div class="card"><p>Error loading your tasks</p></div>';
    };
}

// Load pending approvals
function loadPendingApprovals() {
    const approvalList = document.getElementById('approvalTasksList');
    if (!approvalList) return;
    
    approvalList.innerHTML = '<div class="loading"><i class="fas fa-spinner"></i><p>Loading approvals...</p></div>';
    
    const transaction = db.transaction(['tasks'], 'readonly');
    const taskStore = transaction.objectStore('tasks');
    const request = taskStore.getAll();
    
    request.onsuccess = function() {
        const tasks = request.result.filter(task => 
            task.status === TASK_STATUS.PENDING && 
            task.isVisibleToAll !== false &&
            task.createdBy !== currentUser.email
        );
        
        // Update approval count
        const approvalCount = document.getElementById('approvalCount');
        if (approvalCount) {
            if (tasks.length > 0) {
                approvalCount.textContent = tasks.length;
                approvalCount.classList.remove('hidden');
            } else {
                approvalCount.classList.add('hidden');
            }
        }
        
        displayTasks(tasks, approvalList, false, true, false);
    };
}

// Load team profile
function loadTeamProfile() {
    const profileDiv = document.getElementById('teamProfileInfo');
    if (!profileDiv) return;
    
    // Get user data from database
    const transaction = db.transaction(['users'], 'readonly');
    const userStore = transaction.objectStore('users');
    const request = userStore.get(currentUser.email);
    
    request.onsuccess = function() {
        const user = request.result;
        
        profileDiv.innerHTML = `
            <div style="text-align: center;">
                <div class="employee-avatar team" style="margin: 0 auto 20px; width: 80px; height: 80px;">
                    <i class="fas fa-user"></i>
                </div>
                <h3>${user.name}</h3>
                <p><strong>Email:</strong> ${currentUser.email}</p>
                <p><strong>Role:</strong> Team Member</p>
                <p><strong>Department:</strong> ${user.department || 'Not specified'}</p>
                <p><strong>Zone:</strong> ${user.zone || 'Not assigned'}</p>
                <p><strong>Status:</strong> <span class="employee-status ${user.is_active ? 'active' : 'inactive'}">${user.is_active ? 'Active' : 'Inactive'}</span></p>
                <p><strong>Member Since:</strong> ${new Date().toLocaleDateString()}</p>
            </div>
        `;
    };
}

// Check if a task requires James' approval
function requiresJamesApproval(task) {
    const isAdminRequest = adminCredentials.hasOwnProperty(task.createdBy) || 
                          (task.createdBy && adminCredentials[task.createdBy]);
    return (isAdminRequest || task.isAdminRequest === true) && task.status === TASK_STATUS.PENDING;
}

// Display tasks in a list
function displayTasks(tasks, container, isTeamMember = false, isApproval = false, isReadOnly = false) {
    if (tasks.length === 0) {
        container.innerHTML = '<div class="card"><p>No tasks found</p></div>';
        return;
    }
    
    tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    container.innerHTML = '';
    
    tasks.forEach(task => {
        const taskCard = document.createElement('div');
        taskCard.className = 'task-card';
        
        // Add appropriate CSS class based on task status
        if (task.status === TASK_STATUS.COMPLETED) {
            taskCard.classList.add('completed');
        } else if (task.priority === PRIORITY.URGENT) {
            taskCard.classList.add('urgent');
        } else if (task.priority === PRIORITY.HIGH) {
            taskCard.classList.add('needs-approval');
        }
        
        if (requiresJamesApproval(task)) {
            taskCard.classList.add('admin-request');
        }
        
        const priorityBadge = task.priority === PRIORITY.NORMAL ? '' : 
            `<span class="priority-badge priority-${task.priority.toLowerCase()}">${task.priority}</span>`;
        
        const attachmentsHtml = task.attachments && task.attachments.length > 0 ? 
            `<p><i class="fas fa-paperclip"></i> ${task.attachments.length} attachment(s)</p>` : '';
        
        const approvedByHtml = task.approvedBy ? 
            `<p><strong>Approved by:</strong> ${task.approvedByName || task.approvedBy} on ${new Date(task.approvedAt).toLocaleDateString()}</p>` : '';
        
        const assignedToHtml = task.assignedTo ? 
            `<p><strong>Assigned to:</strong> ${task.assignedToName || task.assignedTo}</p>` : '';
        
        const deadlineHtml = task.deadline ? 
            `<p><strong>Deadline:</strong> ${new Date(task.deadline).toLocaleDateString()}</p>` : '';
        
        const needsJamesApproval = requiresJamesApproval(task);
        const specialApprovalNote = needsJamesApproval && !isTeamMember ? 
            `<div class="approval-alert">
                <i class="fas fa-user-shield"></i>
                <strong>Special Approval Required:</strong> This admin-created task can only be approved by James (james@landscape.com)
            </div>` : '';
        
        const creatorInfo = task.createdBy ? 
            `<p><strong>Created by:</strong> ${task.createdByName || task.createdBy} ${task.isAdminRequest ? '(Admin)' : '(Team Member)'}</p>` : '';
        
        const requestedByHtml = task.requestedBy && task.requestedBy !== task.createdBy ? 
            `<p><strong>Requested by:</strong> ${task.requestedByName || task.requestedBy}</p>` : '';
        
        taskCard.innerHTML = `
            ${specialApprovalNote}
            <div class="task-meta">
                <span class="status-badge status-${task.status}">${task.status}</span>
                ${priorityBadge}
                ${needsJamesApproval && !isTeamMember ? '<span class="priority-badge priority-high">Admin Request</span>' : ''}
                <small>${new Date(task.createdAt).toLocaleString()}</small>
            </div>
            <h4>${task.title}</h4>
            <p>${task.description}</p>
            <p><strong>Zone:</strong> ${task.zone}</p>
            ${creatorInfo}
            ${requestedByHtml}
            ${assignedToHtml}
            ${approvedByHtml}
            ${deadlineHtml}
            ${attachmentsHtml}
            <div class="task-actions">
                ${getTaskActions(task, isTeamMember, isApproval, isReadOnly)}
            </div>
        `;
        
        container.appendChild(taskCard);
    });
    
    // Add event listeners to dynamically created buttons
    attachTaskActionListeners(container);
}

// Attach event listeners to task action buttons
function attachTaskActionListeners(container) {
    container.querySelectorAll('button').forEach(button => {
        // Clone button to remove existing listeners
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        const taskId = parseInt(newButton.getAttribute('data-task-id'));
        if (!taskId) return;
        
        if (newButton.textContent.includes('View Details') || newButton.textContent.includes('View')) {
            newButton.addEventListener('click', () => viewTaskDetails(taskId));
        } else if (newButton.textContent.includes('Start Task') || newButton.textContent.includes('Start')) {
            newButton.addEventListener('click', () => updateTaskStatus(taskId, 'In Progress'));
        } else if (newButton.textContent.includes('Complete Task') || newButton.textContent.includes('Complete')) {
            newButton.addEventListener('click', () => updateTaskStatus(taskId, 'Completed'));
        } else if (newButton.textContent.includes('Pause Task') || newButton.textContent.includes('Pause')) {
            newButton.addEventListener('click', () => updateTaskStatus(taskId, 'Pending'));
        } else if (newButton.textContent.includes('Approve')) {
            newButton.addEventListener('click', () => approveTask(taskId));
        } else if (newButton.textContent.includes('Reject')) {
            newButton.addEventListener('click', () => rejectTask(taskId));
        } else if (newButton.textContent.includes('Edit')) {
            newButton.addEventListener('click', () => editTask(taskId));
        } else if (newButton.textContent.includes('Delete') || newButton.textContent.includes('Cancel')) {
            newButton.addEventListener('click', () => deleteTask(taskId));
        } else if (newButton.textContent.includes('Assign')) {
            newButton.addEventListener('click', () => showAssignModal(taskId));
        }
    });
}

// Get task actions based on user role
function getTaskActions(task, isTeamMember, isApproval = false, isReadOnly = false) {
    let actions = '';
    
    if (isReadOnly) {
        // Read-only view for team members viewing all tasks
        actions = `
            <button class="small blue" data-task-id="${task.id}">
                <i class="fas fa-eye"></i> View Details
            </button>
        `;
    } else if (isTeamMember) {
        // Team member actions for THEIR OWN tasks
        if (task.assignedTo === currentUser.email || task.createdBy === currentUser.email) {
            if (task.status === TASK_STATUS.APPROVED && task.assignedTo === currentUser.email) {
                // Approved task assigned to current user - can start it
                actions = `
                    <button class="small blue" data-task-id="${task.id}">
                        <i class="fas fa-play"></i> Start Task
                    </button>
                `;
            } else if (task.status === TASK_STATUS.IN_PROGRESS && task.assignedTo === currentUser.email) {
                // Task in progress - can complete it
                actions = `
                    <button class="small submit" data-task-id="${task.id}">
                        <i class="fas fa-check"></i> Complete Task
                    </button>
                    <button class="small orange" data-task-id="${task.id}">
                        <i class="fas fa-pause"></i> Pause Task
                    </button>
                `;
            } else if (task.status === TASK_STATUS.PENDING && task.createdBy === currentUser.email) {
                // Task pending approval - creator can cancel it
                actions = `
                    <button class="small red" data-task-id="${task.id}">
                        <i class="fas fa-trash"></i> Cancel Request
                    </button>
                `;
            }
        }
        
        // Always show view details button
        actions += `
            <button class="small blue" data-task-id="${task.id}">
                <i class="fas fa-eye"></i> View Details
            </button>
        `;
    } else {
        // Admin actions
        if (isApproval) {
            const needsJamesApproval = requiresJamesApproval(task);
            
            if (needsJamesApproval) {
                if (currentUser.email === SPECIAL_APPROVER_EMAIL) {
                    actions = `
                        <button class="small submit" data-task-id="${task.id}">
                            <i class="fas fa-check"></i> Approve (James Only)
                        </button>
                        <button class="small red" data-task-id="${task.id}">
                            <i class="fas fa-times"></i> Reject
                        </button>
                        <button class="small blue" data-task-id="${task.id}">
                            <i class="fas fa-eye"></i> View Details
                        </button>
                    `;
                } else {
                    actions = `
                        <button class="small" disabled title="Only James can approve admin requests">
                            <i class="fas fa-user-shield"></i> Awaiting James
                        </button>
                        <button class="small blue" data-task-id="${task.id}">
                            <i class="fas fa-eye"></i> View Details
                        </button>
                    `;
                }
            } else {
                actions = `
                    <button class="small submit" data-task-id="${task.id}">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="small red" data-task-id="${task.id}">
                        <i class="fas fa-times"></i> Reject
                    </button>
                    <button class="small blue" data-task-id="${task.id}">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                `;
            }
        } else {
            actions = `
                <button class="small blue" data-task-id="${task.id}">
                    <i class="fas fa-eye"></i> View
                </button>
            `;
            
            // Edit button for admins
            if (currentUser.role === 'system_admin' || task.createdBy === currentUser.email) {
                actions += `
                    <button class="small orange" data-task-id="${task.id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                `;
            }
            
            // System admin can delete any task
            if (currentUser.role === 'system_admin') {
                actions += `
                    <button class="small red" data-task-id="${task.id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                `;
            }
            
            // Add assign/approve actions based on status
            if (task.status === TASK_STATUS.PENDING) {
                const needsJamesApproval = requiresJamesApproval(task);
                
                if (needsJamesApproval) {
                    if (currentUser.email === SPECIAL_APPROVER_EMAIL) {
                        actions += `
                            <button class="small submit" data-task-id="${task.id}">
                                <i class="fas fa-check"></i> Approve (James Only)
                            </button>
                        `;
                    }
                } else {
                    actions += `
                        <button class="small submit" data-task-id="${task.id}">
                            <i class="fas fa-check"></i> Approve
                        </button>
                    `;
                }
            }
            
            // Allow assignment for approved tasks without assignment OR in progress tasks
            if ((task.status === TASK_STATUS.APPROVED && !task.assignedTo) || 
                (task.status === TASK_STATUS.IN_PROGRESS && !task.assignedTo)) {
                actions += `
                    <button class="small" data-task-id="${task.id}">
                        <i class="fas fa-user-plus"></i> Assign
                    </button>
                `;
            }
        }
    }
    
    return actions;
}

// Show assign modal
function showAssignModal(taskId) {
    currentTaskToAssign = taskId;
    
    // Populate team member dropdown
    const assignSelect = document.getElementById('assignTaskSelect');
    assignSelect.innerHTML = '<option value="">Select Team Member</option>';
    
    // Get active team members from database
    const transaction = db.transaction(['users'], 'readonly');
    const userStore = transaction.objectStore('users');
    const index = userStore.index('role');
    const request = index.getAll('team');
    
    request.onsuccess = function() {
        const teamMembers = request.result.filter(user => user.is_active);
        teamMembers.forEach(member => {
            const option = document.createElement('option');
            option.value = member.email;
            option.textContent = `${member.name} (${member.department || 'No department'})`;
            assignSelect.appendChild(option);
        });
        
        // Show modal
        document.getElementById('assignTaskModal').classList.remove('hidden');
    };
}

// Close assign modal
function closeAssignModal() {
    document.getElementById('assignTaskModal').classList.add('hidden');
    currentTaskToAssign = null;
    document.getElementById('assignTaskSelect').value = '';
    document.getElementById('assignDeadline').value = '';
    document.getElementById('assignNotes').value = '';
}

// Confirm task assignment
function confirmAssignTask() {
    if (!currentTaskToAssign) return;
    
    const assignTo = document.getElementById('assignTaskSelect').value;
    const deadline = document.getElementById('assignDeadline').value;
    const notes = document.getElementById('assignNotes').value;
    
    if (!assignTo) {
        showNotification("Please select a team member to assign", "error");
        return;
    }
    
    // Get team member details
    const transaction = db.transaction(['users', 'tasks'], 'readwrite');
    const userStore = transaction.objectStore('users');
    const taskStore = transaction.objectStore('tasks');
    
    const userRequest = userStore.get(assignTo);
    
    userRequest.onsuccess = function() {
        const assignedUser = userRequest.result;
        if (!assignedUser) {
            showNotification("Selected team member not found", "error");
            return;
        }
        
        // Get the task
        const taskRequest = taskStore.get(currentTaskToAssign);
        
        taskRequest.onsuccess = function() {
            const task = taskRequest.result;
            
            // Update task
            task.assignedTo = assignTo;
            task.assignedToName = assignedUser.name;
            
            if (deadline) {
                task.deadline = deadline;
            }
            
            // Add assignment notes to history
            if (!task.history) task.history = [];
            task.history.push({
                action: 'Task assigned' + (notes ? ' with notes' : ''),
                user: currentUser.name,
                timestamp: new Date().toISOString(),
                assignedTo: assignedUser.name,
                notes: notes || null
            });
            
            const updateRequest = taskStore.put(task);
            
            updateRequest.onsuccess = function() {
                showNotification(`Task assigned to ${assignedUser.name}`, "success");
                closeAssignModal();
                loadAllTasksForAdmin();
                loadPendingApprovals();
            };
            
            updateRequest.onerror = function() {
                showNotification("Error assigning task", "error");
            };
        };
    };
}

// Request task (Team Member)
function requestTask() {
    const title = document.getElementById('taskTitleTeam').value.trim();
    const description = document.getElementById('taskDescriptionTeam').value.trim();
    const zone = document.getElementById('taskZoneTeam').value;
    const priority = document.getElementById('taskPriorityTeam').value;
    const imageFile = document.getElementById('taskImageTeam').files[0];
    
    if (!title || !description || !zone) {
        showNotification("Please fill all required fields", "error");
        return;
    }
    
    const task = {
        title,
        description,
        zone,
        priority,
        status: TASK_STATUS.PENDING,
        createdBy: currentUser.email,
        createdByName: currentUser.name,
        createdAt: new Date().toISOString(),
        requestedBy: currentUser.email,
        requestedByName: currentUser.name,
        isAdminRequest: false,
        isVisibleToAll: true,
        attachments: [],
        history: [{
            action: 'Task requested by team member',
            user: currentUser.name,
            timestamp: new Date().toISOString(),
            status: TASK_STATUS.PENDING
        }]
    };
    
    if (imageFile) {
        const reader = new FileReader();
        reader.onload = function(e) {
            task.attachments.push({
                name: imageFile.name,
                type: 'image',
                data: e.target.result,
                uploadedAt: new Date().toISOString()
            });
            saveTask(task);
        };
        reader.readAsDataURL(imageFile);
    } else {
        saveTask(task);
    }
}

// Save task to database
function saveTask(task, callback) {
    const transaction = db.transaction(['tasks'], 'readwrite');
    const taskStore = transaction.objectStore('tasks');
    
    const request = taskStore.add(task);
    
    request.onsuccess = function() {
        showNotification("Task saved successfully!", "success");
        
        // Clear form
        if (currentUser.role === 'team') {
            document.getElementById('taskTitleTeam').value = '';
            document.getElementById('taskDescriptionTeam').value = '';
            document.getElementById('taskZoneTeam').value = '';
            document.getElementById('taskPriorityTeam').value = 'Normal';
            document.getElementById('taskImageTeam').value = '';
            
            loadAllTasksForTeam();
            showTab('all-tasks-team');
        } else {
            document.getElementById('adminTaskTitle').value = '';
            document.getElementById('adminTaskDescription').value = '';
            document.getElementById('adminTaskZone').value = '';
            document.getElementById('adminTaskPriority').value = 'Normal';
            document.getElementById('assignTo').value = '';
            document.getElementById('taskDeadline').value = '';
            document.getElementById('adminTaskImage').value = '';
            
            loadAllTasksForAdmin();
        }
        
        if (callback) callback(request.result);
    };
    
    request.onerror = function(event) {
        console.error("Error saving task:", event.target.error);
        showNotification("Error saving task!", "error");
    };
}

// Approve task
function approveTask(taskId) {
    const transaction = db.transaction(['tasks'], 'readwrite');
    const taskStore = transaction.objectStore('tasks');
    const request = taskStore.get(taskId);
    
    request.onsuccess = function() {
        const task = request.result;
        
        const needsJamesApproval = requiresJamesApproval(task);
        
        if (needsJamesApproval && currentUser.email !== SPECIAL_APPROVER_EMAIL) {
            showNotification("Only James can approve admin-created tasks!", "error");
            return;
        }
        
        task.status = TASK_STATUS.APPROVED;
        task.approvedBy = currentUser.email;
        task.approvedByName = currentUser.name;
        task.approvedAt = new Date().toISOString();
        
        if (!task.history) task.history = [];
        task.history.push({
            action: 'Task approved' + (needsJamesApproval ? ' (by James - special approver)' : ''),
            user: currentUser.name,
            timestamp: new Date().toISOString(),
            status: TASK_STATUS.APPROVED
        });
        
        const updateRequest = taskStore.put(task);
        
        updateRequest.onsuccess = function() {
            showNotification("Task approved successfully!" + (needsJamesApproval ? " (Special approval by James)" : ""), "success");
            loadAllTasksForAdmin();
            loadPendingApprovals();
            if (currentUser.role === 'team') {
                loadAllTasksForTeam();
            }
        };
    };
}

// Reject task
function rejectTask(taskId) {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;
    
    const transaction = db.transaction(['tasks'], 'readwrite');
    const taskStore = transaction.objectStore('tasks');
    const request = taskStore.get(taskId);
    
    request.onsuccess = function() {
        const task = request.result;
        
        const needsJamesApproval = requiresJamesApproval(task);
        
        if (needsJamesApproval && currentUser.email !== SPECIAL_APPROVER_EMAIL) {
            showNotification("Only James can reject admin-created tasks!", "error");
            return;
        }
        
        task.status = TASK_STATUS.REJECTED;
        task.rejectionReason = reason;
        task.rejectedBy = currentUser.email;
        task.rejectedByName = currentUser.name;
        task.rejectedAt = new Date().toISOString();
        
        if (!task.history) task.history = [];
        task.history.push({
            action: 'Task rejected' + (needsJamesApproval ? ' (by James - special approver)' : ''),
            user: currentUser.name,
            timestamp: new Date().toISOString(),
            status: TASK_STATUS.REJECTED,
            reason: reason
        });
        
        const updateRequest = taskStore.put(task);
        
        updateRequest.onsuccess = function() {
            showNotification("Task rejected!" + (needsJamesApproval ? " (Special rejection by James)" : ""), "warning");
            loadAllTasksForAdmin();
            loadPendingApprovals();
            if (currentUser.role === 'team') {
                loadAllTasksForTeam();
            }
        };
    };
}

// Update task status
function updateTaskStatus(taskId, status) {
    const transaction = db.transaction(['tasks'], 'readwrite');
    const taskStore = transaction.objectStore('tasks');
    const request = taskStore.get(taskId);
    
    request.onsuccess = function() {
        const task = request.result;
        const oldStatus = task.status;
        task.status = status;
        
        if (status === TASK_STATUS.COMPLETED) {
            task.completedBy = currentUser.email;
            task.completedByName = currentUser.name;
            task.completedAt = new Date().toISOString();
        }
        
        if (!task.history) task.history = [];
        task.history.push({
            action: `Status changed from ${oldStatus} to ${status}`,
            user: currentUser.name,
            timestamp: new Date().toISOString(),
            status: status
        });
        
        const updateRequest = taskStore.put(task);
        
        updateRequest.onsuccess = function() {
            showNotification(`Task status updated to ${status}`, "success");
            
            // Refresh all relevant task lists
            if (currentUser.role === 'team') {
                loadMyTasks();
                loadAllTasksForTeam();
            } else {
                loadAllTasksForAdmin();
                loadPendingApprovals();
            }
        };
        
        updateRequest.onerror = function() {
            showNotification("Error updating task status", "error");
        };
    };
}

// View task details
function viewTaskDetails(taskId) {
    const transaction = db.transaction(['tasks'], 'readonly');
    const taskStore = transaction.objectStore('tasks');
    const request = taskStore.get(taskId);
    
    request.onsuccess = function() {
        const task = request.result;
        
        document.getElementById('modalTitle').textContent = task.title;
        
        let historyHtml = '';
        if (task.history && task.history.length > 0) {
            historyHtml = `
                <h4>Task History</h4>
                <div class="timeline">
                    ${task.history.map(item => `
                        <div class="timeline-item">
                            <div class="timeline-date">${new Date(item.timestamp).toLocaleString()}</div>
                            <div class="timeline-content">
                                <strong>${item.action}</strong> by ${item.user}
                                ${item.reason ? `<p><em>Reason: ${item.reason}</em></p>` : ''}
                                ${item.notes ? `<p><em>Notes: ${item.notes}</em></p>` : ''}
                                ${item.status ? `<span class="status-badge status-${item.status}">${item.status}</span>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        let attachmentsHtml = '';
        if (task.attachments && task.attachments.length > 0) {
            attachmentsHtml = `
                <h4>Attachments</h4>
                <div class="attachment-list">
                    ${task.attachments.map((att, index) => {
                        if (att.type === 'image') {
                            return `<img src="${att.data}" alt="Attachment ${index + 1}" style="max-width: 200px; margin: 10px 0;">`;
                        }
                        return `<div class="attachment-item">
                            <i class="fas fa-paperclip"></i>
                            <a href="${att.data}" download="${att.name}">${att.name}</a>
                        </div>`;
                    }).join('')}
                </div>
            `;
        }
        
        const needsJamesApproval = requiresJamesApproval(task);
        const specialNote = needsJamesApproval && task.status === TASK_STATUS.PENDING ? 
            `<div class="approval-alert">
                <i class="fas fa-user-shield"></i>
                <strong>Special Approval Required:</strong> This admin-created task can only be approved by James (james@landscape.com)
            </div>` : '';
        
        const visibilityNote = task.isVisibleToAll === false ? 
            `<div class="approval-alert">
                <i class="fas fa-eye-slash"></i>
                <strong>Visibility:</strong> This task is not visible to all users
            </div>` : 
            `<div class="info-box">
                <i class="fas fa-eye"></i>
                <strong>Visibility:</strong> This task is visible to all team members and admins
            </div>`;
        
        document.getElementById('modalBody').innerHTML = `
            ${specialNote}
            ${visibilityNote}
            <div class="task-card">
                <p><strong>Description:</strong> ${task.description}</p>
                <p><strong>Zone:</strong> ${task.zone}</p>
                <p><strong>Priority:</strong> <span class="priority-badge priority-${task.priority.toLowerCase()}">${task.priority}</span></p>
                <p><strong>Status:</strong> <span class="status-badge status-${task.status}">${task.status}</span></p>
                <p><strong>Created by:</strong> ${task.createdByName || task.createdBy} ${task.isAdminRequest ? '(Admin)' : '(Team Member)'}</p>
                ${task.requestedBy ? `<p><strong>Requested by:</strong> ${task.requestedByName || task.requestedBy}</p>` : ''}
                ${task.approvedBy ? `<p><strong>Approved by:</strong> ${task.approvedByName || task.approvedBy}</p>` : ''}
                ${task.assignedTo ? `<p><strong>Assigned to:</strong> ${task.assignedToName || task.assignedTo}</p>` : ''}
                ${task.deadline ? `<p><strong>Deadline:</strong> ${new Date(task.deadline).toLocaleDateString()}</p>` : ''}
                ${task.completedBy ? `<p><strong>Completed by:</strong> ${task.completedByName || task.completedBy}</p>` : ''}
                ${task.rejectionReason ? `<p><strong>Rejection Reason:</strong> ${task.rejectionReason}</p>` : ''}
                <p><strong>Created:</strong> ${new Date(task.createdAt).toLocaleString()}</p>
                ${needsJamesApproval ? `<p><strong>Special Note:</strong> Requires James' approval</p>` : ''}
            </div>
            ${attachmentsHtml}
            ${historyHtml}
        `;
        
        document.getElementById('taskModal').classList.remove('hidden');
    };
}

// Close modal
function closeModal() {
    document.getElementById('taskModal').classList.add('hidden');
}

// Create task (Admin)
function createTask() {
    const title = document.getElementById('adminTaskTitle').value.trim();
    const description = document.getElementById('adminTaskDescription').value.trim();
    const zone = document.getElementById('adminTaskZone').value;
    const priority = document.getElementById('adminTaskPriority').value;
    const assignedTo = document.getElementById('assignTo').value;
    const deadline = document.getElementById('taskDeadline').value;
    const imageFile = document.getElementById('adminTaskImage').files[0];
    
    if (!title || !description || !zone) {
        showNotification("Please fill all required fields", "error");
        return;
    }
    
    // Get assigned user details if assigned
    let assignedUser = null;
    if (assignedTo) {
        const transaction = db.transaction(['users'], 'readonly');
        const userStore = transaction.objectStore('users');
        const request = userStore.get(assignedTo);
        
        request.onsuccess = function() {
            assignedUser = request.result;
            completeTaskCreation(title, description, zone, priority, assignedTo, assignedUser, deadline, imageFile);
        };
        
        request.onerror = function() {
            showNotification("Error getting user details", "error");
        };
    } else {
        completeTaskCreation(title, description, zone, priority, null, null, deadline, imageFile);
    }
}

// Complete task creation
function completeTaskCreation(title, description, zone, priority, assignedTo, assignedUser, deadline, imageFile) {
    const task = {
        title,
        description,
        zone,
        priority,
        status: assignedTo ? TASK_STATUS.APPROVED : TASK_STATUS.PENDING,
        createdBy: currentUser.email,
        createdByName: currentUser.name,
        createdAt: new Date().toISOString(),
        assignedTo: assignedTo || null,
        assignedToName: assignedUser ? assignedUser.name : null,
        approvedBy: assignedTo ? currentUser.email : null,
        approvedByName: assignedTo ? currentUser.name : null,
        approvedAt: assignedTo ? new Date().toISOString() : null,
        deadline: deadline || null,
        isAdminRequest: true,
        isVisibleToAll: true,
        attachments: [],
        history: [{
            action: assignedTo ? 'Task created and assigned by admin' : 'Task created by admin',
            user: currentUser.name,
            timestamp: new Date().toISOString(),
            status: assignedTo ? TASK_STATUS.APPROVED : TASK_STATUS.PENDING
        }]
    };
    
    if (imageFile) {
        const reader = new FileReader();
        reader.onload = function(e) {
            task.attachments.push({
                name: imageFile.name,
                type: 'image',
                data: e.target.result,
                uploadedAt: new Date().toISOString()
            });
            saveTask(task);
        };
        reader.readAsDataURL(imageFile);
    } else {
        saveTask(task);
    }
}

// Populate assign to dropdown
function populateAssignToDropdown() {
    const assignToSelect = document.getElementById('assignTo');
    if (!assignToSelect) return;
    
    assignToSelect.innerHTML = '<option value="">Select Team Member (Optional)</option>';
    
    // Get active team members from database
    const transaction = db.transaction(['users'], 'readonly');
    const userStore = transaction.objectStore('users');
    const index = userStore.index('role');
    const request = index.getAll('team');
    
    request.onsuccess = function() {
        const teamMembers = request.result.filter(user => user.is_active);
        teamMembers.forEach(member => {
            const option = document.createElement('option');
            option.value = member.email;
            option.textContent = `${member.name} (${member.department || 'No department'})`;
            assignToSelect.appendChild(option);
        });
    };
}

// Edit task
function editTask(taskId) {
    const transaction = db.transaction(['tasks'], 'readwrite');
    const taskStore = transaction.objectStore('tasks');
    const request = taskStore.get(taskId);
    
    request.onsuccess = function() {
        const task = request.result;
        
        const needsJamesApproval = requiresJamesApproval(task);
        
        if (needsJamesApproval && currentUser.email !== SPECIAL_APPROVER_EMAIL && task.status === TASK_STATUS.PENDING) {
            showNotification("Only James can modify pending admin-created tasks!", "error");
            return;
        }
        
        if (currentUser.role !== 'system_admin' && task.createdBy !== currentUser.email) {
            showNotification("You can only edit tasks you created!", "error");
            return;
        }
        
        const newTitle = prompt("Edit task title:", task.title);
        if (newTitle !== null) {
            task.title = newTitle;
            
            const newDescription = prompt("Edit task description:", task.description);
            if (newDescription !== null) {
                task.description = newDescription;
                
                if (!task.history) task.history = [];
                task.history.push({
                    action: 'Task edited',
                    user: currentUser.name,
                    timestamp: new Date().toISOString(),
                    status: task.status
                });
                
                const updateRequest = taskStore.put(task);
                
                updateRequest.onsuccess = function() {
                    showNotification("Task updated successfully!", "success");
                    if (currentUser.role === 'team') {
                        loadAllTasksForTeam();
                    } else {
                        loadAllTasksForAdmin();
                    }
                };
            }
        }
    };
}

// Delete task
function deleteTask(taskId) {
    if (!confirm("Are you sure you want to delete this task?")) return;
    
    if (currentUser.role !== 'system_admin') {
        showNotification("Only system admin can delete tasks!", "error");
        return;
    }
    
    const transaction = db.transaction(['tasks'], 'readwrite');
    const taskStore = transaction.objectStore('tasks');
    const request = taskStore.delete(taskId);
    
    request.onsuccess = function() {
        showNotification("Task deleted successfully!", "success");
        if (currentUser.role === 'team') {
            loadAllTasksForTeam();
            loadMyTasks();
        } else {
            loadAllTasksForAdmin();
            loadPendingApprovals();
        }
    };
}

// Load employees
function loadEmployees() {
    const employeesList = document.getElementById('employeesList');
    if (!employeesList) return;
    
    employeesList.innerHTML = '<div class="loading"><i class="fas fa-spinner"></i><p>Loading employees...</p></div>';
    
    // Get all users from database
    const transaction = db.transaction(['users'], 'readonly');
    const userStore = transaction.objectStore('users');
    const request = userStore.getAll();
    
    request.onsuccess = function() {
        const allUsers = request.result;
        
        let html = '<div class="employee-list">';
        
        allUsers.forEach(user => {
            const roleClass = user.role === 'system_admin' ? 'system_admin' : 
                             user.role === 'admin' ? 'admin' : 'team';
            const roleText = user.role === 'system_admin' ? 'System Admin' : 
                            user.role === 'admin' ? 'Admin' : 'Team Member';
            
            // Special note for James
            const specialNote = user.is_special_approver ? 
                '<span class="priority-badge priority-high" style="margin-left: 10px;">Special Approver</span>' : '';
            
            html += `
                <div class="employee-card">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div class="employee-avatar ${roleClass}">
                            <i class="fas fa-user"></i>
                        </div>
                        <div style="flex: 1;">
                            <h4>${user.name} ${specialNote}</h4>
                            <p><strong>Email:</strong> ${user.email}</p>
                            <p><strong>Role:</strong> ${roleText}</p>
                            ${user.department ? `<p><strong>Department:</strong> ${user.department}</p>` : ''}
                            ${user.zone ? `<p><strong>Zone:</strong> ${user.zone}</p>` : ''}
                            <p><strong>Status:</strong> 
                                <span class="employee-status ${user.is_active ? 'active' : 'inactive'}">
                                    ${user.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </p>
                            ${user.is_special_approver ? 
                              '<p><strong>Special Permission:</strong> Can approve admin-created tasks</p>' : ''}
                        </div>
                    </div>
                    ${currentUser && currentUser.role === 'system_admin' ? `
                        <div class="employee-actions">
                            <button class="small" onclick="editEmployee('${user.email}')">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="small ${user.is_active ? 'red' : 'submit'}" 
                                    onclick="toggleEmployeeStatus('${user.email}', ${!user.is_active})">
                                <i class="fas fa-${user.is_active ? 'ban' : 'check'}"></i> 
                                ${user.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            ${user.role !== 'system_admin' || user.email !== currentUser.email ? `
                                <button class="small red" onclick="deleteEmployee('${user.email}')">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
            `;
        });
        
        html += '</div>';
        employeesList.innerHTML = html;
    };
}

// Show add employee modal
function showAddEmployeeModal() {
    // Reset form
    document.getElementById('newEmployeeName').value = '';
    document.getElementById('newEmployeeEmail').value = '';
    document.getElementById('newEmployeePassword').value = '';
    document.getElementById('newEmployeeRole').value = 'team';
    document.getElementById('newEmployeeStatus').value = 'active';
    document.getElementById('newEmployeeDepartment').value = 'Landscaping';
    document.getElementById('newEmployeeZone').value = '';
    document.getElementById('newEmployeeSpecialApprover').checked = false;
    
    // Show appropriate fields
    toggleRoleFields();
    
    // Show modal
    document.getElementById('addEmployeeModal').classList.remove('hidden');
}

// Close add employee modal
function closeAddEmployeeModal() {
    document.getElementById('addEmployeeModal').classList.add('hidden');
}

// Toggle role-specific fields
function toggleRoleFields() {
    const role = document.getElementById('newEmployeeRole').value;
    const teamFields = document.getElementById('teamMemberFields');
    const adminFields = document.getElementById('adminFields');
    
    if (role === 'team') {
        if (teamFields) teamFields.classList.remove('hidden');
        if (adminFields) adminFields.classList.add('hidden');
    } else {
        if (teamFields) teamFields.classList.add('hidden');
        if (adminFields) adminFields.classList.remove('hidden');
    }
}

// Add new employee
function addNewEmployee() {
    const name = document.getElementById('newEmployeeName').value.trim();
    const email = document.getElementById('newEmployeeEmail').value.trim();
    const password = document.getElementById('newEmployeePassword').value;
    const role = document.getElementById('newEmployeeRole').value;
    const status = document.getElementById('newEmployeeStatus').value;
    const department = document.getElementById('newEmployeeDepartment').value;
    const zone = document.getElementById('newEmployeeZone').value;
    const isSpecialApprover = document.getElementById('newEmployeeSpecialApprover').checked;
    
    if (!name || !email || !password) {
        showNotification("Please fill all required fields", "error");
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showNotification("Please enter a valid email address", "error");
        return;
    }
    
    // Check if email already exists
    const transaction = db.transaction(['users'], 'readwrite');
    const userStore = transaction.objectStore('users');
    const checkRequest = userStore.get(email);
    
    checkRequest.onsuccess = function() {
        if (checkRequest.result) {
            showNotification("Email already exists!", "error");
            return;
        }
        
        // Create new user object
        const newUser = {
            email: email,
            name: name,
            password: password,
            role: role,
            is_active: status === 'active',
            is_hardcoded: false // Mark as dynamically added
        };
        
        // Add role-specific fields
        if (role === 'team') {
            newUser.department = department;
            newUser.zone = zone;
        } else if (role === 'admin' || role === 'system_admin') {
            if (role === 'admin' && isSpecialApprover) {
                newUser.is_special_approver = true;
            }
        }
        
        // Save to database
        const addRequest = userStore.add(newUser);
        
        addRequest.onsuccess = function() {
            showNotification(`Employee ${name} added successfully!`, "success");
            closeAddEmployeeModal();
            loadEmployees();
            
            // Update memory objects for login
            if (role === 'team') {
                teamMembers[email] = newUser;
            } else {
                adminCredentials[email] = newUser;
            }
        };
        
        addRequest.onerror = function() {
            showNotification("Error adding employee", "error");
        };
    };
}

// Edit employee
function editEmployee(email) {
    if (email === SPECIAL_APPROVER_EMAIL) {
        showNotification("James' special approver status cannot be modified", "warning");
        return;
    }
    
    const transaction = db.transaction(['users'], 'readwrite');
    const userStore = transaction.objectStore('users');
    const request = userStore.get(email);
    
    request.onsuccess = function() {
        const user = request.result;
        if (!user) return;
        
        const newName = prompt("Edit employee name:", user.name);
        if (newName !== null && newName.trim() !== '') {
            user.name = newName.trim();
            
            // For team members, also ask for department and zone
            if (user.role === 'team') {
                const newDept = prompt("Edit department:", user.department || '');
                if (newDept !== null) {
                    user.department = newDept;
                }
                
                const newZone = prompt("Edit zone:", user.zone || '');
                if (newZone !== null) {
                    user.zone = newZone;
                }
            }
            
            const updateRequest = userStore.put(user);
            
            updateRequest.onsuccess = function() {
                showNotification("Employee updated successfully!", "success");
                loadEmployees();
                
                // Update memory objects
                if (user.role === 'team' && teamMembers[email]) {
                    teamMembers[email] = user;
                } else if (adminCredentials[email]) {
                    adminCredentials[email] = user;
                }
            };
        }
    };
}

// Toggle employee status
function toggleEmployeeStatus(email, newStatus) {
    if (email === SPECIAL_APPROVER_EMAIL && !newStatus) {
        showNotification("Cannot deactivate James as he is the special approver!", "error");
        return;
    }
    
    if (email === currentUser.email && !newStatus) {
        showNotification("You cannot deactivate your own account!", "error");
        return;
    }
    
    const transaction = db.transaction(['users'], 'readwrite');
    const userStore = transaction.objectStore('users');
    const request = userStore.get(email);
    
    request.onsuccess = function() {
        const user = request.result;
        if (!user) return;
        
        user.is_active = newStatus;
        
        const updateRequest = userStore.put(user);
        
        updateRequest.onsuccess = function() {
            showNotification(`Employee ${newStatus ? 'activated' : 'deactivated'} successfully!`, "success");
            loadEmployees();
            
            // Update memory objects
            if (user.role === 'team' && teamMembers[email]) {
                teamMembers[email].is_active = newStatus;
            } else if (adminCredentials[email]) {
                adminCredentials[email].is_active = newStatus;
            }
        };
    };
}

// Delete employee
function deleteEmployee(email) {
    if (email === SPECIAL_APPROVER_EMAIL) {
        showNotification("Cannot delete James as he is the special approver!", "error");
        return;
    }
    
    if (email === currentUser.email) {
        showNotification("You cannot delete your own account!", "error");
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${email}? This action cannot be undone.`)) {
        return;
    }
    
    // First check if employee has any assigned tasks
    const taskTransaction = db.transaction(['tasks'], 'readonly');
    const taskStore = taskTransaction.objectStore('tasks');
    const assignedIndex = taskStore.index('assignedTo');
    const assignedRequest = assignedIndex.getAll(email);
    
    assignedRequest.onsuccess = function() {
        const assignedTasks = assignedRequest.result;
        
        if (assignedTasks.length > 0) {
            showNotification(`Cannot delete employee. ${assignedTasks.length} tasks are assigned to this employee.`, "error");
            return;
        }
        
        // Check if employee created any tasks
        const createdIndex = taskStore.index('createdBy');
        const createdRequest = createdIndex.getAll(email);
        
        createdRequest.onsuccess = function() {
            const createdTasks = createdRequest.result;
            
            if (createdTasks.length > 0) {
                showNotification(`Cannot delete employee. ${createdTasks.length} tasks were created by this employee.`, "error");
                return;
            }
            
            // Now delete the employee
            const userTransaction = db.transaction(['users'], 'readwrite');
            const userStore = userTransaction.objectStore('users');
            const deleteRequest = userStore.delete(email);
            
            deleteRequest.onsuccess = function() {
                showNotification("Employee deleted successfully!", "success");
                loadEmployees();
                
                // Remove from memory objects
                if (teamMembers[email]) {
                    delete teamMembers[email];
                }
                if (adminCredentials[email]) {
                    delete adminCredentials[email];
                }
            };
        };
    };
}

// Filter tasks for team portal
function filterTasksTeam() {
    const searchTerm = document.getElementById('searchTasksTeam').value.toLowerCase();
    const statusFilter = document.getElementById('filterStatusTeam').value;
    
    const transaction = db.transaction(['tasks'], 'readonly');
    const taskStore = transaction.objectStore('tasks');
    const request = taskStore.getAll();
    
    request.onsuccess = function() {
        let tasks = request.result;
        
        tasks = tasks.filter(task => task.isVisibleToAll !== false);
        
        if (searchTerm) {
            tasks = tasks.filter(task => 
                task.title.toLowerCase().includes(searchTerm) ||
                task.description.toLowerCase().includes(searchTerm) ||
                task.zone.toLowerCase().includes(searchTerm) ||
                (task.createdByName && task.createdByName.toLowerCase().includes(searchTerm))
            );
        }
        
        if (statusFilter) {
            tasks = tasks.filter(task => task.status === statusFilter);
        }
        
        displayTasks(tasks, document.getElementById('allTasksListTeam'), true, false, true);
    };
}

// Filter tasks for admin portal
function filterTasksAdmin() {
    const searchTerm = document.getElementById('searchTasksAdmin').value.toLowerCase();
    const statusFilter = document.getElementById('filterStatusAdmin').value;
    
    const transaction = db.transaction(['tasks'], 'readonly');
    const taskStore = transaction.objectStore('tasks');
    const request = taskStore.getAll();
    
    request.onsuccess = function() {
        let tasks = request.result;
        
        tasks = tasks.filter(task => task.isVisibleToAll !== false);
        
        if (searchTerm) {
            tasks = tasks.filter(task => 
                task.title.toLowerCase().includes(searchTerm) ||
                task.description.toLowerCase().includes(searchTerm) ||
                task.zone.toLowerCase().includes(searchTerm) ||
                (task.createdByName && task.createdByName.toLowerCase().includes(searchTerm))
            );
        }
        
        if (statusFilter) {
            tasks = tasks.filter(task => task.status === statusFilter);
        }
        
        displayTasks(tasks, document.getElementById('allTasksListAdmin'), false, false, false);
    };
}

// Generate report
function generateReport() {
    const reportType = document.getElementById('reportType').value;
    const dateRange = document.getElementById('dateRange').value;
    let startDate, endDate;
    
    const now = new Date();
    switch(dateRange) {
        case 'today':
            startDate = new Date(now.setHours(0,0,0,0));
            endDate = new Date(now.setHours(23,59,59,999));
            break;
        case 'week':
            startDate = new Date(now.setDate(now.getDate() - 7));
            break;
        case 'month':
            startDate = new Date(now.setMonth(now.getMonth() - 1));
            break;
        case 'quarter':
            startDate = new Date(now.setMonth(now.getMonth() - 3));
            break;
        case 'year':
            startDate = new Date(now.setFullYear(now.getFullYear() - 1));
            break;
        case 'custom':
            startDate = new Date(document.getElementById('startDate').value);
            endDate = new Date(document.getElementById('endDate').value);
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                showNotification("Please select valid dates", "error");
                return;
            }
            break;
    }
    
    const transaction = db.transaction(['tasks'], 'readonly');
    const taskStore = transaction.objectStore('tasks');
    const request = taskStore.getAll();
    
    request.onsuccess = function() {
        let tasks = request.result;
        
        tasks = tasks.filter(task => {
            const taskDate = new Date(task.createdAt);
            return taskDate >= startDate && (!endDate || taskDate <= endDate);
        });
        
        let reportHtml = '';
        
        switch(reportType) {
            case 'summary':
                reportHtml = generateSummaryReport(tasks);
                break;
            case 'byZone':
                reportHtml = generateZoneReport(tasks);
                break;
            case 'byStatus':
                reportHtml = generateStatusReport(tasks);
                break;
            case 'byEmployee':
                reportHtml = generateEmployeeReport(tasks);
                break;
            case 'performance':
                reportHtml = generatePerformanceReport(tasks);
                break;
        }
        
        document.getElementById('reportContent').innerHTML = reportHtml;
        document.getElementById('reportResults').classList.remove('hidden');
    };
}

// Generate summary report
function generateSummaryReport(tasks) {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === TASK_STATUS.COMPLETED).length;
    const pendingTasks = tasks.filter(t => t.status === TASK_STATUS.PENDING).length;
    const inProgressTasks = tasks.filter(t => t.status === TASK_STATUS.IN_PROGRESS).length;
    const urgentTasks = tasks.filter(t => t.priority === PRIORITY.URGENT).length;
    const adminRequests = tasks.filter(t => t.isAdminRequest === true).length;
    const teamRequests = tasks.filter(t => t.isAdminRequest === false).length;
    const pendingAdminRequests = tasks.filter(t => t.isAdminRequest === true && t.status === TASK_STATUS.PENDING).length;
    
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    return `
        <div class="report-summary">
            <div class="report-card">
                <h4>Total Tasks</h4>
                <div class="count">${totalTasks}</div>
            </div>
            <div class="report-card">
                <h4>Completed</h4>
                <div class="count">${completedTasks}</div>
                <div class="percentage">${completionRate}% completion rate</div>
            </div>
            <div class="report-card">
                <h4>Admin Requests</h4>
                <div class="count">${adminRequests}</div>
                <div class="percentage">${pendingAdminRequests} pending James' approval</div>
            </div>
            <div class="report-card">
                <h4>Team Requests</h4>
                <div class="count">${teamRequests}</div>
            </div>
        </div>
        <div class="stat-grid">
            <div class="stat-item">
                <span class="stat-label">Pending:</span>
                <span class="stat-value">${pendingTasks}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">In Progress:</span>
                <span class="stat-value">${inProgressTasks}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Approved:</span>
                <span class="stat-value">${tasks.filter(t => t.status === TASK_STATUS.APPROVED).length}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Rejected:</span>
                <span class="stat-value">${tasks.filter(t => t.status === TASK_STATUS.REJECTED).length}</span>
            </div>
        </div>
    `;
}

// Generate zone report
function generateZoneReport(tasks) {
    const zoneStats = {};
    
    tasks.forEach(task => {
        if (!zoneStats[task.zone]) {
            zoneStats[task.zone] = {
                total: 0,
                completed: 0,
                pending: 0,
                urgent: 0,
                adminRequests: 0,
                teamRequests: 0
            };
        }
        
        zoneStats[task.zone].total++;
        if (task.status === TASK_STATUS.COMPLETED) zoneStats[task.zone].completed++;
        if (task.status === TASK_STATUS.PENDING) zoneStats[task.zone].pending++;
        if (task.priority === PRIORITY.URGENT) zoneStats[task.zone].urgent++;
        if (task.isAdminRequest === true) zoneStats[task.zone].adminRequests++;
        if (task.isAdminRequest === false) zoneStats[task.zone].teamRequests++;
    });
    
    let html = '<div class="stat-grid">';
    Object.entries(zoneStats).forEach(([zone, stats]) => {
        const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
        
        html += `
            <div class="stat-item" style="flex-direction: column; align-items: flex-start;">
                <strong>${zone}</strong>
                <div style="width: 100%; margin-top: 5px;">
                    <div style="display: flex; justify-content: space-between;">
                        <span>Total: ${stats.total}</span>
                        <span>${completionRate}% complete</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.8em; color: #666;">
                        <span>Admin: ${stats.adminRequests}</span>
                        <span>Team: ${stats.teamRequests}</span>
                        <span>Pending: ${stats.pending}</span>
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    return html;
}

// Generate status report
function generateStatusReport(tasks) {
    const statusStats = {};
    
    tasks.forEach(task => {
        if (!statusStats[task.status]) {
            statusStats[task.status] = 0;
        }
        statusStats[task.status]++;
    });
    
    let html = '<div class="stat-grid">';
    Object.entries(statusStats).forEach(([status, count]) => {
        const percentage = tasks.length > 0 ? Math.round((count / tasks.length) * 100) : 0;
        
        html += `
            <div class="stat-item">
                <span class="stat-label">${status}:</span>
                <span class="stat-value">${count} (${percentage}%)</span>
            </div>
        `;
    });
    html += '</div>';
    
    return html;
}

// Generate employee report
function generateEmployeeReport(tasks) {
    const employeeStats = {};
    
    tasks.forEach(task => {
        if (task.createdBy) {
            if (!employeeStats[task.createdBy]) {
                employeeStats[task.createdBy] = {
                    name: task.createdByName || task.createdBy,
                    created: 0,
                    assigned: 0,
                    completed: 0
                };
            }
            employeeStats[task.createdBy].created++;
            
            if (task.status === TASK_STATUS.COMPLETED) {
                employeeStats[task.createdBy].completed++;
            }
        }
        
        if (task.assignedTo) {
            if (!employeeStats[task.assignedTo]) {
                employeeStats[task.assignedTo] = {
                    name: task.assignedToName || task.assignedTo,
                    created: 0,
                    assigned: 0,
                    completed: 0
                };
            }
            employeeStats[task.assignedTo].assigned++;
        }
    });
    
    let html = '<div class="stat-grid">';
    Object.entries(employeeStats).forEach(([email, stats]) => {
        const completionRate = stats.created > 0 ? Math.round((stats.completed / stats.created) * 100) : 0;
        
        html += `
            <div class="stat-item" style="flex-direction: column; align-items: flex-start;">
                <strong>${stats.name}</strong>
                <div style="width: 100%; margin-top: 5px;">
                    <div style="display: flex; justify-content: space-between;">
                        <span>Created: ${stats.created}</span>
                        <span>${completionRate}% completed</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.8em; color: #666;">
                        <span>Assigned: ${stats.assigned}</span>
                        <span>Completed: ${stats.completed}</span>
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    return html;
}

// Generate performance report
function generatePerformanceReport(tasks) {
    return generateSummaryReport(tasks);
}

// Export to Excel
function exportToExcel() {
    const transaction = db.transaction(['tasks'], 'readonly');
    const taskStore = transaction.objectStore('tasks');
    const request = taskStore.getAll();
    
    request.onsuccess = function() {
        const tasks = request.result.filter(task => task.isVisibleToAll !== false);
        
        let csvContent = "Title,Description,Zone,Priority,Status,Request Type,Created By,Assigned To,Approved By,Created At,Deadline,Completed At,Special Approval Required\n";
        
        tasks.forEach(task => {
            const isAdminRequest = task.isAdminRequest === true ? "Admin Request" : "Team Request";
            const needsJamesApproval = requiresJamesApproval(task) ? "Yes" : "No";
            
            const row = [
                `"${task.title.replace(/"/g, '""')}"`,
                `"${task.description.replace(/"/g, '""')}"`,
                `"${task.zone}"`,
                `"${task.priority}"`,
                `"${task.status}"`,
                `"${isAdminRequest}"`,
                `"${task.createdByName || task.createdBy}"`,
                `"${task.assignedToName || task.assignedTo || ''}"`,
                `"${task.approvedByName || task.approvedBy || ''}"`,
                `"${new Date(task.createdAt).toLocaleString()}"`,
                `"${task.deadline ? new Date(task.deadline).toLocaleDateString() : ''}"`,
                `"${task.completedAt ? new Date(task.completedAt).toLocaleString() : ''}"`,
                `"${needsJamesApproval}"`
            ].join(',');
            
            csvContent += row + "\n";
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `tasks_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification("Excel file downloaded successfully!", "success");
    };
}

// Show notification
function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 
                        type === 'error' ? 'exclamation-circle' : 
                        type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 5000);
}

// Check authentication
function checkAuth() {
    const user = localStorage.getItem('currentUser');
    if (user) {
        currentUser = JSON.parse(user);
        userRole = localStorage.getItem('userRole');
        if (userRole === 'team') {
            showTeamPortal();
        } else {
            showAdminPortal();
        }
    }
}

// Logout
function logout() {
    currentUser = null;
    userRole = '';
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userRole');
    
    hideAllSections();
    document.getElementById('welcomeSection').classList.remove('hidden');
    
    document.getElementById('teamEmail').value = '';
    document.getElementById('teamPassword').value = '';
    document.getElementById('adminEmail').value = '';
    document.getElementById('adminPassword').value = '';
    
    showNotification("Logged out successfully", "info");
}

// Make functions available globally
window.showTeamLogin = showTeamLogin;
window.showAdminLogin = showAdminLogin;
window.backToWelcome = backToWelcome;
window.teamLogin = teamLogin;
window.adminLogin = adminLogin;
window.logout = logout;
window.showTab = showTab;
window.requestTask = requestTask;
window.createTask = createTask;
window.viewTaskDetails = viewTaskDetails;
window.closeModal = closeModal;
window.updateTaskStatus = updateTaskStatus;
window.approveTask = approveTask;
window.rejectTask = rejectTask;
window.editTask = editTask;
window.deleteTask = deleteTask;
window.showAssignModal = showAssignModal;
window.closeAssignModal = closeAssignModal;
window.confirmAssignTask = confirmAssignTask;
window.filterTasksTeam = filterTasksTeam;
window.filterTasksAdmin = filterTasksAdmin;
window.generateReport = generateReport;
window.exportToExcel = exportToExcel;
window.showAddEmployeeModal = showAddEmployeeModal;
window.closeAddEmployeeModal = closeAddEmployeeModal;
window.toggleRoleFields = toggleRoleFields;
window.addNewEmployee = addNewEmployee;
window.editEmployee = editEmployee;
window.toggleEmployeeStatus = toggleEmployeeStatus;
window.deleteEmployee = deleteEmployee;