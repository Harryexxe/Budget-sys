/* ===========================================================
   app.js — Personal Budget App (Behavior/Logic Only)
   =========================================================== */

const STORAGE_KEY = 'hb_budget_v1';

// ---------- Utility Functions ----------
function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(amount);
}

function getMonthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0,
      v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function formatMonthLabel(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const date = new Date(y, m - 1);
  return date.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

// ---------- Data Store with Validation ----------
function getDefaultCategories() {
  return [
    'Rent / Mortgage',
    'Groceries / Food',
    'Utilities (Electricity, Water)',
    'Mobile / Internet',
    'Transport',
    'Fuel',
    'Health / Medical',
    'Insurance',
    'Entertainment',
    'Subscriptions',
    'Education',
    'Shopping',
    'Household',
    'Gifts / Donations',
    'Savings',
    'Miscellaneous'
  ];
}

function loadStore() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      return createDefaultStore();
    }
    
    const parsed = JSON.parse(data);
    if (!parsed.meta || !parsed.settings || !parsed.entries) {
      throw new Error('Invalid data structure');
    }
    
    return parsed;
  } catch (error) {
    console.error('Storage error, resetting data:', error);
    showToast('Storage corrupted, resetting to default', 'error');
    const defaultStore = createDefaultStore();
    saveStore(defaultStore);
    return defaultStore;
  }
}

function createDefaultStore() {
  return {
    meta: { version: '1', lastUpdated: new Date().toISOString() },
    settings: {
      currencyLocale: 'en-IN',
      expenseCategories: getDefaultCategories()
    },
    entries: {},
    goals: [],
    loans: [],
    savings: []
  };
}

function saveStore(data) {
  try {
    data.meta.lastUpdated = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Save failed:', error);
    showToast('Failed to save data', 'error');
    return false;
  }
}

let store = loadStore();

// ---------- Toast/Notification System ----------
function showToast(message, type = 'info') {
  const existingToasts = document.querySelectorAll('.toast');
  existingToasts.forEach(toast => toast.remove());
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <span class="toast-message">${message}</span>
      <button class="toast-close">&times;</button>
    </div>
  `;
  
  document.body.appendChild(toast);
  
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => toast.remove());
  
  setTimeout(() => {
    if (toast.parentElement) {
      toast.remove();
    }
  }, 4000);
}

// ---------- Validation Functions ----------
function validateRequired(value, fieldName) {
  if (!value || value.toString().trim() === '') {
    return `${fieldName} is required`;
  }
  return null;
}

function validateNumber(value, fieldName) {
  const num = Number(value);
  if (isNaN(num)) {
    return `${fieldName} must be a valid number`;
  }
  if (num <= 0) {
    return `${fieldName} must be greater than 0`;
  }
  return null;
}

function validateDate(value, fieldName) {
  if (!value) {
    return `${fieldName} is required`;
  }
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return `${fieldName} must be a valid date`;
  }
  return null;
}

function validateForm(data, fields) {
  const errors = {};
  fields.forEach(field => {
    const value = data[field.name];
    let error = null;
    
    if (field.required) {
      error = validateRequired(value, field.label);
    }
    
    if (!error && field.type === 'number') {
      error = validateNumber(value, field.label);
    }
    
    if (!error && field.type === 'date') {
      error = validateDate(value, field.label);
    }
    
    if (error) {
      errors[field.name] = error;
    }
  });
  
  return errors;
}

// ---------- CRUD for Entries ----------
function addEntry(entry) {
  const key = getMonthKey(entry.date);
  if (!store.entries[key]) store.entries[key] = [];
  entry.id = uuid();
  entry.createdAt = new Date().toISOString();
  entry.updatedAt = entry.createdAt;
  store.entries[key].push(entry);
  
  if (saveStore(store)) {
    showToast('Entry added successfully', 'success');
    return true;
  }
  return false;
}

function updateEntry(entryId, updates) {
  for (const [monthKey, arr] of Object.entries(store.entries)) {
    const idx = arr.findIndex(e => e.id === entryId);
    if (idx !== -1) {
      store.entries[monthKey][idx] = {
        ...store.entries[monthKey][idx],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      if (saveStore(store)) {
        showToast('Entry updated successfully', 'success');
        return true;
      }
      return false;
    }
  }
  return false;
}

function deleteEntry(entryId) {
  for (const [monthKey, arr] of Object.entries(store.entries)) {
    const idx = arr.findIndex(e => e.id === entryId);
    if (idx !== -1) {
      arr.splice(idx, 1);
      if (saveStore(store)) {
        showToast('Entry deleted successfully', 'success');
        return true;
      }
      return false;
    }
  }
  return false;
}

function getTotalsForMonth(monthKey) {
  const entries = store.entries[monthKey] || [];
  const income = entries
    .filter(e => e.type === 'income')
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const expense = entries
    .filter(e => e.type === 'expense')
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const remaining = income - expense;
  return { income, expense, remaining };
}

function getRecentTransactions(limit = 10) {
  const all = Object.values(store.entries).flat();
  return all
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit);
}

function getExpensesSeriesForWindow(endMonthKey, monthsCount = 5) {
    const [endYear, endMonth] = endMonthKey.split('-').map(Number);
    
    // Calculate start month (4 months before the end month)
    let startMonth = endMonth - (monthsCount - 1);
    let startYear = endYear;
    
    // Handle year boundary crossing
    while (startMonth < 1) {
        startMonth += 12;
        startYear--;
    }
    
    const start = new Date(startYear, startMonth - 1);
    const result = [];
    
    for (let i = 0; i < monthsCount; i++) {
        const d = new Date(start.getFullYear(), start.getMonth() + i);
        const key = getMonthKey(d);
        const total =
            (store.entries[key] || [])
                .filter(e => e.type === 'expense')
                .reduce((sum, e) => sum + Number(e.amount), 0);
        result.push({ monthKey: key, total });
    }
    return result;
}

function addCustomCategory(category) {
  const list = store.settings.expenseCategories;
  if (!list.some(c => c.toLowerCase() === category.toLowerCase())) {
    list.push(category);
    saveStore(store);
  }
}

// ---------- Savings ----------
function addSavings(amount, description, date, note = '') {
  const entry = {
    id: uuid(),
    date,
    amount: Number(amount),
    type: 'expense',
    category: 'Savings',
    description,
    note,
    monthKey: getMonthKey(date),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  return addEntry(entry);
}

// ---------- Loans ----------
function addLoan(loan) {
  loan.id = uuid();
  loan.createdAt = new Date().toISOString();
  loan.updatedAt = loan.createdAt;
  store.loans.push(loan);
  
  if (saveStore(store)) {
    showToast('Loan added successfully', 'success');
    return true;
  }
  return false;
}

function updateLoan(id, updates) {
  const idx = store.loans.findIndex(l => l.id === id);
  if (idx !== -1) {
    store.loans[idx] = { 
      ...store.loans[idx], 
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    if (saveStore(store)) {
      showToast('Loan updated successfully', 'success');
      return true;
    }
    return false;
  }
  return false;
}

function deleteLoan(id) {
  const idx = store.loans.findIndex(l => l.id === id);
  if (idx !== -1) {
    store.loans.splice(idx, 1);
    
    if (saveStore(store)) {
      showToast('Loan deleted successfully', 'success');
      return true;
    }
    return false;
  }
  return false;
}

// ---------- Goals ----------
function addGoal(goal) {
  goal.id = uuid();
  goal.createdAt = new Date().toISOString();
  goal.updatedAt = goal.createdAt;
  store.goals.push(goal);
  
  if (saveStore(store)) {
    showToast('Goal added successfully', 'success');
    return true;
  }
  return false;
}

function updateGoal(id, updates) {
  const idx = store.goals.findIndex(g => g.id === id);
  if (idx !== -1) {
    store.goals[idx] = { 
      ...store.goals[idx], 
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    if (saveStore(store)) {
      showToast('Goal updated successfully', 'success');
      return true;
    }
    return false;
  }
  return false;
}

function deleteGoal(id) {
  const idx = store.goals.findIndex(g => g.id === id);
  if (idx !== -1) {
    store.goals.splice(idx, 1);
    
    if (saveStore(store)) {
      showToast('Goal deleted successfully', 'success');
      return true;
    }
    return false;
  }
  return false;
}

function getGoalProgress(goal) {
  const totalSavings = Object.values(store.entries)
    .flat()
    .filter(
      e =>
        e.type === 'expense' &&
        e.category.toLowerCase() === 'savings' &&
        (e.description?.toLowerCase().includes(goal.title.toLowerCase()) ||
         e.note?.toLowerCase().includes(goal.title.toLowerCase()))
    )
    .reduce((sum, e) => sum + Number(e.amount), 0);
  
  const progress = (totalSavings / goal.targetAmount) * 100;
  return Math.min(progress, 100);
}

// ---------- Chart Instances ----------
let chartInstance;
let savingsChartInstance = null;
let currentChartStart = getMonthKey(new Date());
let homeActiveCategory = 'budget';
let homeChartCurrentMonth = getMonthKey(new Date());

// ---------- Home Page Functions ----------
function renderHomePage() {
  renderHomeCategoryButtons();
  renderHomeCategoryContent();
  renderRecentTransactions();
  updateNavigationHighlight('home');
}

function renderHomeCategoryButtons() {
    const chartContainer = document.getElementById('expensesChartContainer');
    if (!chartContainer) return;

    let buttonsContainer = document.getElementById('homeCategoryButtons');
    if (!buttonsContainer) {
        buttonsContainer = document.createElement('div');
        buttonsContainer.id = 'homeCategoryButtons';
        buttonsContainer.className = 'home-category-buttons-grid';
        // Insert after the dashboard-top-section
        const dashboardTopSection = document.querySelector('.dashboard-top-section');
        if (dashboardTopSection) {
            dashboardTopSection.parentNode.insertBefore(buttonsContainer, dashboardTopSection.nextSibling);
        } else {
            // Fallback: insert before recent transactions
            const recentSection = document.querySelector('.recent-transactions-section');
            if (recentSection) {
                recentSection.parentNode.insertBefore(buttonsContainer, recentSection);
            }
        }
    }

    const categories = [
        { id: 'budget', label: 'Budget' },
        { id: 'loans', label: 'Loans' },
        { id: 'goals', label: 'Goals' },
        { id: 'savings', label: 'Savings' }
    ];

    buttonsContainer.innerHTML = categories.map(cat => `
        <button 
            onclick="switchHomeCategory('${cat.id}')" 
            class="home-category-btn ${homeActiveCategory === cat.id ? 'active' : ''}"
        >
            ${cat.label}
        </button>
    `).join('');
}

function switchHomeCategory(category) {
    homeActiveCategory = category;
    renderHomeCategoryButtons();
    renderHomeCategoryContent();
    
    // Reset to current month when switching to budget
    if (category === 'budget') {
        homeChartCurrentMonth = getMonthKey(new Date());
    }
}

function renderHomeCategoryContent() {
    const chartContainer = document.getElementById('expensesChartContainer');
    if (!chartContainer) return;

    chartContainer.innerHTML = '';
    
    document.querySelectorAll('#expensesChartContainer canvas').forEach(canvas => canvas.remove());

    const budgetCardContainer = document.getElementById('budgetCardContainer');
    if (budgetCardContainer) {
        if (homeActiveCategory === 'budget') {
            budgetCardContainer.classList.remove('hidden');
            renderBudgetCard();
        } else {
            budgetCardContainer.classList.add('hidden');
        }
    }

    switch (homeActiveCategory) {
        case 'budget':
            renderBudgetHomeContent();
            break;
        case 'loans':
            renderLoansHomeContent();
            break;
        case 'goals':
            renderGoalsHomeContent();
            break;
        case 'savings':
            renderSavingsHomeContent();
            break;
    }
}

function renderBudgetHomeContent() {
  const chartContainer = document.getElementById('expensesChartContainer');
    if (!chartContainer) return;
  
 // Show navigation for budget category
    const chartNavigation = document.getElementById('budgetChartNavigation');
    if (chartNavigation) {
        chartNavigation.classList.remove('hidden');
    }
    
    chartContainer.innerHTML = `
        <div class="chart-navigation">
            <button id="chartPrevMonth" class="chart-nav-btn">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
            </button>
            <div id="chartMonthLabel" class="chart-month-label">${formatMonthLabel(homeChartCurrentMonth)}</div>
            <button id="chartNextMonth" class="chart-nav-btn">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
            </button>
        </div>
        <div class="chart-wrapper">
            <canvas id="expensesChart"></canvas>
        </div>
    `;
    
    // Add event listeners for navigation
    setTimeout(() => {
        const prevBtn = document.getElementById('chartPrevMonth');
        const nextBtn = document.getElementById('chartNextMonth');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', navigateHomeChartMonths.bind(null, -1));
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', navigateHomeChartMonths.bind(null, 1));
        }
        
        renderHomeExpensesChart(homeChartCurrentMonth);
    }, 50);
}

function navigateHomeChartMonths(direction) {
    const [year, month] = homeChartCurrentMonth.split('-').map(Number);
    let newMonth = month + direction;
    let newYear = year;
    
    if (newMonth > 12) {
        newMonth = 1;
        newYear++;
    } else if (newMonth < 1) {
        newMonth = 12;
        newYear--;
    }
    
    homeChartCurrentMonth = `${newYear}-${String(newMonth).padStart(2, '0')}`;
    
    // Update the month label to show the current (end) month
    const monthLabel = document.getElementById('chartMonthLabel');
    if (monthLabel) {
        monthLabel.textContent = formatMonthLabel(homeChartCurrentMonth);
    }
    
    // Re-render the chart with the new end month
    renderHomeExpensesChart(homeChartCurrentMonth);
    
    // Update the budget card to show the current (end) month
    if (homeActiveCategory === 'budget') {
        renderBudgetCard();
    }
}

function renderHomeExpensesChart(endMonthKey) {
    const ctx = document.getElementById('expensesChart');
    if (!ctx) return;

    // Get data for 5 months: 4 previous + current month
    const dataSeries = getExpensesSeriesForWindow(endMonthKey, 5);
    const labels = dataSeries.map(d => {
        const [y, m] = d.monthKey.split('-').map(Number);
        const date = new Date(y, m - 1);
        return date.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
    });
    const data = dataSeries.map(d => d.total);

    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Monthly Expenses',
                    data,
                    backgroundColor: 'rgba(204, 204, 255, 0.7)',
                    borderColor: 'rgba(204, 204, 255, 1)',
                    borderWidth: 1,
                    borderRadius: 8
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => formatINR(value)
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: context => 'Expenses: ' + formatINR(context.parsed.y)
                    }
                },
                legend: {
                    display: false
                }
            }
        }
    });
}


function renderBudgetCard() {
    const currentMonth = homeChartCurrentMonth; // Use the home chart month
    const totals = getTotalsForMonth(currentMonth);
    const monthLabel = formatMonthLabel(currentMonth);
    
    const budgetCardContainer = document.getElementById('budgetCardContainer');
    if (!budgetCardContainer) return;
    
    budgetCardContainer.innerHTML = `
        <div class="budget-summary-card">
            <div class="budget-summary-content">
                <div class="budget-summary-title">${monthLabel}</div>
                <div class="budget-summary-details">
                    <div class="budget-summary-item">
                        <span class="budget-label">Total Income:</span>
                        <span class="budget-income">${formatINR(totals.income)}</span>
                    </div>
                    <div class="budget-summary-item">
                        <span class="budget-label">Total Expense:</span>
                        <span class="budget-expense">${formatINR(totals.expense)}</span>
                    </div>
                    <div class="budget-summary-item budget-balance">
                        <span class="budget-label">Balance:</span>
                        <span class="budget-remaining ${totals.remaining >= 0 ? 'positive' : 'negative'}">
                            ${formatINR(totals.remaining)}
                        </span>
                    </div>
                </div>
            </div>
            <button class="budget-summary-button" onclick="navigateToCurrentMonthBudget()">
                More Info
            </button>
        </div>
    `;
}

function navigateToCurrentMonthBudget() {
  showPage('budget');
}

function renderLoansHomeContent() {
  const chartContainer = document.getElementById('expensesChartContainer');
  const loans = store.loans;

  if (loans.length === 0) {
    chartContainer.innerHTML = `
      <div class="empty-state">
        <p>No loans tracked yet.</p>
        <p class="empty-state-subtitle">Add loans in the Loans section to see progress here.</p>
      </div>
    `;
    return;
  }

  chartContainer.innerHTML = `
    <div class="loans-grid">
      ${loans.map(loan => {
        const paid = loan.paidAmount || 0;
        const remaining = loan.principal - paid;
        const progress = (paid / loan.principal) * 100;
        
        return `
          <div class="loan-card">
            <div class="loan-header">
              <div>
                <h3 class="loan-name">${loan.name}</h3>
                <p class="loan-lender">${loan.lender || 'No lender specified'}</p>
              </div>
            </div>
            
            <div class="loan-stats">
              <div class="loan-stat">
                <div class="loan-stat-label">Principal</div>
                <div class="loan-stat-value">${formatINR(loan.principal)}</div>
              </div>
              <div class="loan-stat">
                <div class="loan-stat-label">Paid</div>
                <div class="loan-stat-value paid">${formatINR(paid)}</div>
              </div>
              <div class="loan-stat">
                <div class="loan-stat-label">Remaining</div>
                <div class="loan-stat-value remaining">${formatINR(remaining)}</div>
              </div>
              <div class="loan-stat">
                <div class="loan-stat-label">Progress</div>
                <div class="loan-stat-value progress">${progress.toFixed(1)}%</div>
              </div>
            </div>
            
            <div class="loan-progress-circle">
              <div class="progress-circle-svg">
                <svg viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#eee"
                    stroke-width="3"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-dasharray="${progress}, 100"
                    transform="rotate(-90 18 18)"
                  />
                  <text x="18" y="20.5" text-anchor="middle" font-size="8" fill="currentColor" font-weight="bold">
                    ${progress.toFixed(0)}%
                  </text>
                </svg>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderSavingsHomeContent() {
  const chartContainer = document.getElementById('expensesChartContainer');
  if (!chartContainer) return;
  
  const currentMonth = getMonthKey(new Date());
  const currentMonthSavings = getSavingsForMonth(currentMonth);
  const totalSavings = getTotalSavings();
  const savingsByMonth = getSavingsByMonth(12);

  chartContainer.innerHTML = `
    <div class="savings-overview">
      <div class="savings-stats-grid">
        <div class="savings-stat-card">
          <div class="savings-stat-label">This Month's Savings</div>
          <div class="savings-stat-value current">${formatINR(currentMonthSavings)}</div>
        </div>
        <div class="savings-stat-card">
          <div class="savings-stat-label">Total Savings</div>
          <div class="savings-stat-value total">${formatINR(totalSavings)}</div>
        </div>
      </div>
    </div>
    
    <div class="savings-chart-card">
      <h3 class="savings-chart-title">Savings Over Time</h3>
      <div class="savings-chart-container">
        <canvas id="savingsChart"></canvas>
      </div>
    </div>
  `;
  
  setTimeout(() => {
    renderSavingsChart(savingsByMonth);
  }, 50);
}

function renderGoalsHomeContent() {
  const chartContainer = document.getElementById('expensesChartContainer');
  const goals = store.goals;

  if (goals.length === 0) {
    chartContainer.innerHTML = `
      <div class="empty-state">
        <p>No goals set yet.</p>
        <p class="empty-state-subtitle">Add goals in the Goals section to track progress here.</p>
      </div>
    `;
    return;
  }

  chartContainer.innerHTML = `
    <div class="goals-grid">
      ${goals.map(goal => {
        const progress = getGoalProgress(goal);
        const targetDate = new Date(goal.targetDate);
        const isOverdue = targetDate < new Date();
        
        return `
          <div class="goal-card">
            <div class="goal-header">
              <div>
                <h3 class="goal-title">${goal.title}</h3>
                <p class="goal-description">${goal.description || 'No description'}</p>
              </div>
            </div>
            
            <div class="goal-stats">
              <div class="goal-stat">
                <div class="goal-stat-label">Target Amount</div>
                <div class="goal-stat-value">${formatINR(goal.targetAmount)}</div>
              </div>
              <div class="goal-stat">
                <div class="goal-stat-label">Target Date</div>
                <div class="goal-stat-value ${isOverdue ? 'overdue' : ''}">
                  ${targetDate.toLocaleDateString('en-IN')}
                </div>
              </div>
            </div>
            
            <div class="goal-progress-circle">
              <div class="progress-circle-svg">
                <svg viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#eee"
                    stroke-width="3"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-dasharray="${progress}, 100"
                    transform="rotate(-90 18 18)"
                  />
                  <text x="18" y="20.5" text-anchor="middle" font-size="8" fill="currentColor" font-weight="bold">
                    ${progress.toFixed(0)}%
                  </text>
                </svg>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ---------- Savings Page ----------
function renderSavingsPage() {
  const page = document.getElementById('page-savings');
  if (!page) return;
  
  const currentMonth = getMonthKey(new Date());
  const currentMonthSavings = getSavingsForMonth(currentMonth);
  const totalSavings = getTotalSavings();
  const savingsByMonth = getSavingsByMonth(12);

  page.innerHTML = `
    <div class="page-header">
      <h2 class="page-title-large">Savings</h2>
      <p class="page-subtitle">Track your savings progress and history</p>
    </div>
    
    <div class="savings-overview">
      <div class="savings-stats-grid">
        <div class="savings-stat-card">
          <div class="savings-stat-label">This Month's Savings</div>
          <div class="savings-stat-value current">${formatINR(currentMonthSavings)}</div>
        </div>
        <div class="savings-stat-card">
          <div class="savings-stat-label">Total Savings</div>
          <div class="savings-stat-value total">${formatINR(totalSavings)}</div>
        </div>
        <div class="savings-stat-card">
          <div class="savings-stat-label">Average Monthly</div>
          <div class="savings-stat-value average">${formatINR(totalSavings / Math.max(savingsByMonth.filter(m => m.savings > 0).length, 1))}</div>
        </div>
      </div>
    </div>
    
    <div class="savings-chart-card">
      <div class="section-header">
        <h3 class="section-title">Savings History</h3>
        <button onclick="showAddSavingsModal()" class="primary-btn">Add Savings</button>
      </div>
      <div class="savings-chart-container">
        <canvas id="savingsHistoryChart"></canvas>
      </div>
    </div>
    
    <div class="savings-entries-section">
      <div class="section-header">
        <h3 class="section-title">Recent Savings Entries</h3>
      </div>
      <div id="savingsEntriesList" class="savings-entries-list"></div>
    </div>
  `;
  
  renderSavingsHistoryChart(savingsByMonth);
  renderSavingsEntriesList();
  updateNavigationHighlight('savings');
}

function showAddSavingsModal() {
  const modal = `
    <div class="modal-content">
      <h3 class="modal-title">Add Savings</h3>
      <form id="savingsForm" class="modal-form">
        <div class="form-field">
          <label class="form-label">Amount (₹)</label>
          <input type="number" name="amount" step="0.01" required class="form-input" placeholder="0.00">
        </div>
        <div class="form-field">
          <label class="form-label">Description</label>
          <input type="text" name="description" required class="form-input" placeholder="e.g., Emergency fund">
        </div>
        <div class="form-field">
          <label class="form-label">Date</label>
          <input type="date" name="date" required class="form-input" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-field">
          <label class="form-label">Note (optional)</label>
          <textarea name="note" rows="3" class="form-textarea" placeholder="Additional notes..."></textarea>
        </div>
        <div class="modal-actions">
          <button type="submit" class="btn-primary">Add Savings</button>
          <button type="button" onclick="hideModal()" class="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  `;
  
  showModal(modal);
  
  const form = document.getElementById('savingsForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    
    const amount = parseFloat(formData.get('amount'));
    const description = formData.get('description');
    const date = formData.get('date');
    const note = formData.get('note');
    
    if (addSavings(amount, description, date, note)) {
      hideModal();
      renderSavingsPage();
      if (activePage === 'home') {
        renderHomePage();
      }
    }
  });
}

// ---------- Loans Page ----------
function renderLoansPage() {
  const page = document.getElementById('page-loans');
  if (!page) return;
  
  const loans = store.loans;

  page.innerHTML = `
    <div class="page-header">
      <h2 class="page-title-large">Loans</h2>
      <p class="page-subtitle">Track your loans and repayment progress</p>
    </div>
    
    <div class="loans-header">
      <h3 class="section-title">Your Loans</h3>
      <button onclick="showAddLoanModal()" class="primary-btn">Add Loan</button>
    </div>
    
    <div id="loansList" class="loans-grid"></div>
  `;
  
  renderLoansList();
  updateNavigationHighlight('loans');
}

function renderLoansList() {
  const list = document.getElementById('loansList');
  if (!list) return;
  
  const loans = store.loans;
  
  if (loans.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">💰</div>
        <h3 class="empty-state-title">No Loans Tracked</h3>
        <p class="empty-state-subtitle">Start tracking your loans to monitor repayment progress</p>
        <button onclick="showAddLoanModal()" class="primary-btn">Add Your First Loan</button>
      </div>
    `;
    return;
  }
  
  list.innerHTML = loans.map(loan => {
    const paid = loan.paidAmount || 0;
    const remaining = loan.principal - paid;
    const progress = (paid / loan.principal) * 100;
    const isOverdue = loan.dueDate && new Date(loan.dueDate) < new Date();
    
    return `
      <div class="loan-card">
        <div class="loan-header">
          <div class="loan-info">
            <h3 class="loan-name">${loan.name}</h3>
            <p class="loan-lender">${loan.lender || 'No lender specified'}</p>
          </div>
          <div class="loan-actions">
            <button onclick="showEditLoanModal('${loan.id}')" class="btn-edit">
              <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
            </button>
            <button onclick="confirmDeleteLoan('${loan.id}')" class="btn-delete">
              <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="loan-stats">
          <div class="loan-stat">
            <div class="loan-stat-label">Principal</div>
            <div class="loan-stat-value">${formatINR(loan.principal)}</div>
          </div>
          <div class="loan-stat">
            <div class="loan-stat-label">Paid</div>
            <div class="loan-stat-value paid">${formatINR(paid)}</div>
          </div>
          <div class="loan-stat">
            <div class="loan-stat-label">Remaining</div>
            <div class="loan-stat-value remaining">${formatINR(remaining)}</div>
          </div>
          <div class="loan-stat">
            <div class="loan-stat-label">Progress</div>
            <div class="loan-stat-value progress">${progress.toFixed(1)}%</div>
          </div>
        </div>
        
        ${loan.dueDate ? `
          <div class="loan-due-date">
            <div class="loan-due-label">Due Date</div>
            <div class="loan-due-value ${isOverdue ? 'overdue' : ''}">
              ${new Date(loan.dueDate).toLocaleDateString('en-IN')}
              ${isOverdue ? ' (Overdue)' : ''}
            </div>
          </div>
        ` : ''}
        
        <div class="loan-progress-bar">
          <div class="progress-track">
            <div class="progress-fill" style="width: ${progress}%"></div>
          </div>
          <div class="progress-text">${progress.toFixed(1)}%</div>
        </div>
        
        ${remaining > 0 ? `
          <div class="loan-action">
            <button onclick="showAddPaymentModal('${loan.id}')" class="btn-primary full-width">
              Add Payment
            </button>
          </div>
        ` : `
          <div class="loan-completed">
            <div class="completed-text">✓ Loan Fully Paid</div>
          </div>
        `}
      </div>
    `;
  }).join('');
}

function showAddLoanModal() {
  const modal = `
    <div class="modal-content">
      <h3 class="modal-title">Add Loan</h3>
      <form id="loanForm" class="modal-form">
        <div class="form-field">
          <label class="form-label">Loan Name</label>
          <input type="text" name="name" required class="form-input" placeholder="e.g., Car Loan">
        </div>
        <div class="form-field">
          <label class="form-label">Lender</label>
          <input type="text" name="lender" class="form-input" placeholder="e.g., HDFC Bank">
        </div>
        <div class="form-field">
          <label class="form-label">Principal Amount (₹)</label>
          <input type="number" name="principal" step="0.01" required class="form-input" placeholder="0.00">
        </div>
        <div class="form-field">
          <label class="form-label">Due Date (optional)</label>
          <input type="date" name="dueDate" class="form-input">
        </div>
        <div class="form-field">
          <label class="form-label">Notes (optional)</label>
          <textarea name="notes" rows="3" class="form-textarea" placeholder="Additional notes..."></textarea>
        </div>
        <div class="modal-actions">
          <button type="submit" class="btn-primary">Add Loan</button>
          <button type="button" onclick="hideModal()" class="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  `;
  
  showModal(modal);
  
  const form = document.getElementById('loanForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    
    const loan = {
      name: formData.get('name'),
      lender: formData.get('lender'),
      principal: parseFloat(formData.get('principal')),
      paidAmount: 0,
      dueDate: formData.get('dueDate') || null,
      notes: formData.get('notes') || ''
    };
    
    if (addLoan(loan)) {
      hideModal();
      renderLoansPage();
      if (activePage === 'home') {
        renderHomePage();
      }
    }
  });
}

// ---------- Goals Page ----------
function renderGoalsPage() {
  const page = document.getElementById('page-goals');
  if (!page) return;
  
  page.innerHTML = `
    <div class="page-header">
      <h2 class="page-title-large">Financial Goals</h2>
      <p class="page-subtitle">Set and track your financial goals</p>
    </div>
    
    <div class="goals-header">
      <h3 class="section-title">Your Goals</h3>
      <button onclick="showAddGoalModal()" class="primary-btn">Add Goal</button>
    </div>
    
    <div id="goalsList" class="goals-grid"></div>
  `;
  
  renderGoalsList();
  updateNavigationHighlight('goals');
}

function renderGoalsList() {
  const list = document.getElementById('goalsList');
  if (!list) return;
  
  const goals = store.goals;
  
  if (goals.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎯</div>
        <h3 class="empty-state-title">No Goals Set</h3>
        <p class="empty-state-subtitle">Set financial goals to track your progress and stay motivated</p>
        <button onclick="showAddGoalModal()" class="primary-btn">Set Your First Goal</button>
      </div>
    `;
    return;
  }
  
  list.innerHTML = goals.map(goal => {
    const progress = getGoalProgress(goal);
    const targetDate = new Date(goal.targetDate);
    const today = new Date();
    const daysRemaining = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));
    const isOverdue = daysRemaining < 0;
    
    return `
      <div class="goal-card">
        <div class="goal-header">
          <div class="goal-info">
            <h3 class="goal-title">${goal.title}</h3>
            <p class="goal-description">${goal.description || 'No description'}</p>
          </div>
          <div class="goal-actions">
            <button onclick="showEditGoalModal('${goal.id}')" class="btn-edit">
              <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
            </button>
            <button onclick="confirmDeleteGoal('${goal.id}')" class="btn-delete">
              <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="goal-stats">
          <div class="goal-stat">
            <div class="goal-stat-label">Target Amount</div>
            <div class="goal-stat-value">${formatINR(goal.targetAmount)}</div>
          </div>
          <div class="goal-stat">
            <div class="goal-stat-label">Target Date</div>
            <div class="goal-stat-value ${isOverdue ? 'overdue' : ''}">
              ${targetDate.toLocaleDateString('en-IN')}
            </div>
          </div>
          <div class="goal-stat">
            <div class="goal-stat-label">Progress</div>
            <div class="goal-stat-value progress">${progress.toFixed(1)}%</div>
          </div>
          <div class="goal-stat">
            <div class="goal-stat-label">${isOverdue ? 'Days Overdue' : 'Days Remaining'}</div>
            <div class="goal-stat-value ${isOverdue ? 'overdue' : ''}">
              ${Math.abs(daysRemaining)}
            </div>
          </div>
        </div>
        
        <div class="goal-progress-bar">
          <div class="progress-track">
            <div class="progress-fill" style="width: ${progress}%"></div>
          </div>
          <div class="progress-text">${progress.toFixed(1)}%</div>
        </div>
        
        ${progress < 100 ? `
          <div class="goal-action">
            <button onclick="showAddSavingsToGoalModal('${goal.id}')" class="btn-primary full-width">
              Add Savings Towards Goal
            </button>
          </div>
        ` : `
          <div class="goal-completed">
            <div class="completed-text">✓ Goal Achieved!</div>
          </div>
        `}
      </div>
    `;
  }).join('');
}

function showAddGoalModal() {
  const modal = `
    <div class="modal-content">
      <h3 class="modal-title">Add Goal</h3>
      <form id="goalForm" class="modal-form">
        <div class="form-field">
          <label class="form-label">Goal Title</label>
          <input type="text" name="title" required class="form-input" placeholder="e.g., New Laptop">
        </div>
        <div class="form-field">
          <label class="form-label">Description (optional)</label>
          <textarea name="description" rows="2" class="form-textarea" placeholder="Goal description..."></textarea>
        </div>
        <div class="form-field">
          <label class="form-label">Target Amount (₹)</label>
          <input type="number" name="targetAmount" step="0.01" required class="form-input" placeholder="0.00">
        </div>
        <div class="form-field">
          <label class="form-label">Target Date</label>
          <input type="date" name="targetDate" required class="form-input">
        </div>
        <div class="modal-actions">
          <button type="submit" class="btn-primary">Add Goal</button>
          <button type="button" onclick="hideModal()" class="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  `;
  
  showModal(modal);
  
  const form = document.getElementById('goalForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    
    const goal = {
      title: formData.get('title'),
      description: formData.get('description') || '',
      targetAmount: parseFloat(formData.get('targetAmount')),
      targetDate: formData.get('targetDate')
    };
    
    if (addGoal(goal)) {
      hideModal();
      renderGoalsPage();
      if (activePage === 'home') {
        renderHomePage();
      }
    }
  });
}

// ---------- Settings Page ----------
function renderSettingsPage() {
  const page = document.getElementById('page-settings');
  if (!page) return;
  
  page.innerHTML = `
    <div class="page-header">
      <h2 class="page-title-large">Settings</h2>
      <p class="page-subtitle">Manage your budget app preferences</p>
    </div>
    
    <div class="settings-sections">
      <div class="settings-section">
        <h3 class="settings-section-title">Data Management</h3>
        <div class="settings-options">
          <div class="settings-option">
            <div class="settings-option-info">
              <div class="settings-option-title">Export Data</div>
              <div class="settings-option-description">Download your budget data as a backup file</div>
            </div>
            <button onclick="exportData()" class="btn-primary">Export Data</button>
          </div>
          
          <div class="settings-option">
            <div class="settings-option-info">
              <div class="settings-option-title">Import Data</div>
              <div class="settings-option-description">Restore from a backup file</div>
            </div>
            <div class="settings-option-actions">
              <button onclick="document.getElementById('importFile').click()" class="btn-primary">Import Data</button>
              <input type="file" id="importFile" accept=".json" class="file-input">
            </div>
          </div>
          
          <div class="settings-option danger-zone">
            <div class="settings-option-info">
              <div class="settings-option-title">Clear All Data</div>
              <div class="settings-option-description">Permanently delete all your budget data</div>
            </div>
            <button onclick="confirmClearData()" class="btn-danger">Clear Data</button>
          </div>
        </div>
      </div>
      
      <div class="settings-section">
        <h3 class="settings-section-title">Expense Categories</h3>
        <div class="categories-list">
          ${store.settings.expenseCategories.map(category => `
            <div class="category-item">
              <span class="category-name">${category}</span>
              ${!getDefaultCategories().includes(category) ? `
                <button onclick="removeCustomCategory('${category}')" class="btn-delete">
                  <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </button>
              ` : ''}
            </div>
          `).join('')}
        </div>
        
        <div class="add-category-form">
          <form id="addCategoryForm" class="inline-form">
            <input type="text" name="newCategory" placeholder="New category name" class="form-input">
            <button type="submit" class="btn-primary">Add Category</button>
          </form>
        </div>
      </div>
      
      <div class="settings-section">
        <h3 class="settings-section-title">App Information</h3>
        <div class="app-info">
          <div class="info-item">
            <span class="info-label">App Version</span>
            <span class="info-value">1.0.0</span>
          </div>
          <div class="info-item">
            <span class="info-label">Data Version</span>
            <span class="info-value">${store.meta.version}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Last Updated</span>
            <span class="info-value">${new Date(store.meta.lastUpdated).toLocaleString('en-IN')}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Total Entries</span>
            <span class="info-value">${Object.values(store.entries).flat().length}</span>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Add category form handler
  const addCategoryForm = document.getElementById('addCategoryForm');
  if (addCategoryForm) {
    addCategoryForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(addCategoryForm);
      const newCategory = formData.get('newCategory').trim();
      
      if (newCategory && !store.settings.expenseCategories.includes(newCategory)) {
        addCustomCategory(newCategory);
        addCategoryForm.reset();
        renderSettingsPage();
        showToast('Category added successfully', 'success');
      }
    });
  }
  
  updateNavigationHighlight('settings');
}

// ---------- Helper Functions for Home Dashboard ----------
function getSavingsForMonth(monthKey) {
  const entries = store.entries[monthKey] || [];
  return entries
    .filter(e => e.type === 'expense' && e.category === 'Savings')
    .reduce((sum, e) => sum + Number(e.amount), 0);
}

function getTotalSavings() {
  return Object.values(store.entries)
    .flat()
    .filter(e => e.type === 'expense' && e.category === 'Savings')
    .reduce((sum, e) => sum + Number(e.amount), 0);
}

function getSavingsByMonth(monthsCount = 12) {
  const result = [];
  const currentDate = new Date();
  
  for (let i = monthsCount - 1; i >= 0; i--) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const monthKey = getMonthKey(date);
    const savings = getSavingsForMonth(monthKey);
    
    result.push({
      monthKey,
      savings,
      label: date.toLocaleString('en-IN', { month: 'short', year: '2-digit' })
    });
  }
  
  return result;
}

function renderSavingsChart(savingsData) {
  const ctx = document.getElementById('savingsChart');
  if (!ctx) return;

  if (savingsChartInstance) {
    savingsChartInstance.destroy();
    savingsChartInstance = null;
  }

  const hasData = savingsData.some(d => d.savings > 0);
  
  if (!hasData) {
    const chartContainer = ctx.closest('.savings-chart-card');
    if (chartContainer) {
      chartContainer.innerHTML = `
        <h3 class="savings-chart-title">Savings Over Time</h3>
        <div class="empty-chart-state">
          <div class="empty-chart-icon">💾</div>
          <h3 class="empty-chart-title">No Savings Data</h3>
          <p class="empty-chart-message">Please add your savings details in the Savings section</p>
          <button onclick="showPage('savings')" class="empty-chart-button">
            Go to Savings
          </button>
        </div>
      `;
    }
    return;
  }

  savingsChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: savingsData.map(d => d.label),
      datasets: [
        {
          label: 'Monthly Savings',
          data: savingsData.map(d => d.savings),
          backgroundColor: 'rgba(204, 204, 255, 0.7)',
          borderColor: 'rgba(204, 204, 255, 1)',
          borderWidth: 1,
          borderRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: value => formatINR(value)
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: context => 'Savings: ' + formatINR(context.parsed.y)
          }
        },
        legend: {
          display: false
        }
      }
    }
  });
}

// ---------- Chart Functions ----------
function renderExpensesChart(startMonthKey) {
  const ctx = document.getElementById('expensesChart');
  if (!ctx) return;

  const dataSeries = getExpensesSeriesForWindow(startMonthKey);
  const labels = dataSeries.map(d => {
    const [y, m] = d.monthKey.split('-').map(Number);
    const date = new Date(y, m - 1);
    return date.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
  });
  const data = dataSeries.map(d => d.total);

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Monthly Expenses',
          data,
          backgroundColor: 'rgba(204, 204, 255, 0.7)',
          borderColor: 'rgba(204, 204, 255, 1)',
          borderWidth: 1,
          borderRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: value => formatINR(value)
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: context => 'Expenses: ' + formatINR(context.parsed.y)
          }
        },
        legend: {
          display: false
        }
      }
    }
  });
}

// ---------- Chart Navigation ----------
function navigateChartWindow(direction) {
  const [year, month] = currentChartStart.split('-').map(Number);
  let newMonth = month + direction;
  let newYear = year;
  
  if (newMonth > 12) {
    newMonth = 1;
    newYear++;
  } else if (newMonth < 1) {
    newMonth = 12;
    newYear--;
  }
  
  currentChartStart = `${newYear}-${String(newMonth).padStart(2, '0')}`;
  renderExpensesChart(currentChartStart);
  
  if (homeActiveCategory === 'budget') {
    renderBudgetCard();
  }
}

// ---------- Import / Export ----------
function exportData() {
  try {
    const data = JSON.stringify(store, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `budget-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    showToast('Data exported successfully', 'success');
  } catch (error) {
    console.error('Export failed:', error);
    showToast('Failed to export data', 'error');
  }
}

function importData(file, merge = false) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const imported = JSON.parse(e.target.result);
      
      if (!imported.meta || !imported.settings || !imported.entries) {
        throw new Error('Invalid file format');
      }
      
      if (merge) {
        Object.keys(imported.entries).forEach(monthKey => {
          if (!store.entries[monthKey]) {
            store.entries[monthKey] = [];
          }
          store.entries[monthKey].push(...imported.entries[monthKey]);
        });
        
        store.settings.expenseCategories = Array.from(
          new Set([
            ...store.settings.expenseCategories,
            ...(imported.settings.expenseCategories || [])
          ])
        );
        
        store.goals.push(...(imported.goals || []));
        store.loans.push(...(imported.loans || []));
      } else {
        store = imported;
      }
      
      if (saveStore(store)) {
        showToast('Data imported successfully', 'success');
        setTimeout(() => {
          location.reload();
        }, 1000);
      }
    } catch (error) {
      console.error('Import failed:', error);
      showToast('Invalid file format or corrupted data', 'error');
    }
  };
  reader.readAsText(file);
}

// ---------- Modal System ----------
function showModal(content) {
  const modalRoot = document.getElementById('modalRoot');
  if (!modalRoot) return;
  
  modalRoot.innerHTML = content;
  modalRoot.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function hideModal() {
  const modalRoot = document.getElementById('modalRoot');
  if (!modalRoot) return;
  
  modalRoot.classList.add('hidden');
  modalRoot.innerHTML = '';
  document.body.style.overflow = '';
}

// ---------- Confirmation Modal ----------
function showConfirmationModal(title, message, onConfirm, onCancel = null) {
  const modal = `
    <div class="modal-content">
      <h3 class="modal-title">${title}</h3>
      <p class="modal-message">${message}</p>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="hideModal(); ${onCancel ? onCancel + '()' : ''}">
          Cancel
        </button>
        <button type="button" class="btn-primary btn-danger" onclick="hideModal(); ${onConfirm}()">
          Confirm
        </button>
      </div>
    </div>
  `;
  showModal(modal);
}

// ---------- Page Navigation ----------
let activePage = 'home';

function showPage(pageName) {
  document.querySelectorAll('.page').forEach(page => {
    page.classList.add('hidden');
  });
  
  const targetPage = document.getElementById(`page-${pageName}`);
  if (targetPage) {
    targetPage.classList.remove('hidden');
    activePage = pageName;
  }
  
  updateNavigationHighlight(pageName);
  
  if (window.innerWidth < 768) {
    const sidebar = document.getElementById('sidebar');
    if (sidebar && !sidebar.classList.contains('hidden')) {
      toggleSidebar();
    }
  }
  
  if (pafunction renderBudgetPage(monthKey) {
  currentBudgetMonth = monthKey;
  const totals = getTotalsForMonth(monthKey);
  
  const monthLabel = document.getElementById('budgetMonthLabel');
  const remainingBalance = document.getElementById('remainingBalance');
  
  // Update budget summary cards
  const totalIncomeElement = document.getElementById('totalIncome');
  const totalExpensesElement = document.getElementById('totalExpenses');
  const totalSavingsElement = document.getElementById('totalSavings');
  
  if (monthLabel) monthLabel.textContent = formatMonthLabel(monthKey);
  if (remainingBalance) remainingBalance.textContent = formatINR(totals.remaining);
  
  // Update summary card values
  if (totalIncomeElement) totalIncomeElement.textContent = formatINR(totals.income);
  if (totalExpensesElement) totalExpensesElement.textContent = formatINR(totals.expense);
  if (totalSavingsElement) {
    // Calculate savings from the current month's entries
    const savingsAmount = getSavingsForMonth(monthKey);
    totalSavingsElement.textContent = formatINR(savingsAmount);
  }
  
  renderEntriesList(monthKey);
  renderBudgetSummaryTable(monthKey);
  updateNavigationHighlight('budget');
}ctorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  const activeBtn = document.querySelector(`[data-page="${pageName}"]`);
  if (activeBtn) {
    activeBtn.classList.add('active');
  }
}

// ---------- Recent Transactions ----------
function renderRecentTransactions() {
  const list = document.getElementById('recentList');
  if (!list) return;
  
  const txns = getRecentTransactions(5);
  
  if (txns.length === 0) {
    list.innerHTML = '<div class="empty-transactions">No transactions yet. Add entries in the Budget page.</div>';
    return;
  }
  
  list.innerHTML = txns.map(t => `
    <div class="transaction-item">
      <div class="transaction-info">
        <div class="transaction-description">${t.description || t.category}</div>
        <div class="transaction-meta">${new Date(t.date).toLocaleDateString('en-IN')} • ${t.category}</div>
      </div>
      <div class="transaction-amount ${t.type === 'income' ? 'income' : 'expense'}">
        ${t.type === 'income' ? '+' : '-'} ${formatINR(t.amount)}
        <div class="transaction-type">${t.type}</div>
      </div>
    </div>
  `).join('');
}

// ---------- Budget Page ----------
let currentBudgetMonth = getMonthKey(new Date());
let showAllEntries = false;

function renderBudgetPage(monthKey) {
  currentBudgetMonth = monthKey;
  const totals = getTotalsForMonth(monthKey);
  
  const monthLabel = document.getElementById('budgetMonthLabel');
  const remainingBalance = document.getElementById('remainingBalance');
  
  if (monthLabel) monthLabel.textContent = formatMonthLabel(monthKey);
  if (remainingBalance) remainingBalance.textContent = formatINR(totals.remaining);
  
  renderEntriesList(monthKey);
  renderBudgetSummaryTable(monthKey);
  updateNavigationHighlight('budget');
}

function renderEntriesList(monthKey) {
  const list = document.getElementById('entriesList');
  const entries = store.entries[monthKey] || [];
  
  const sortedEntries = entries.sort((a, b) => new Date(b.date) - new Date(a.date));
  const entriesToShow = showAllEntries ? sortedEntries : sortedEntries.slice(0, 5);
  
  if (entries.length === 0) {
    list.innerHTML = '<div class="empty-entries">No entries for this month. Click "Add Entry" to start.</div>';
    return;
  }
  
  list.innerHTML = entriesToShow.map(e => `
    <div class="entry-item">
      <div class="entry-info">
        <div class="entry-description">${e.description || e.category}</div>
        <div class="entry-meta">${new Date(e.date).toLocaleDateString('en-IN')} • ${e.category}</div>
        ${e.note ? `<div class="entry-note">${e.note}</div>` : ''}
      </div>
      <div class="entry-actions">
        <div class="entry-amount ${e.type === 'income' ? 'income' : 'expense'}">
          ${e.type === 'income' ? '+' : '-'} ${formatINR(e.amount)}
          <div class="entry-type">${e.type}</div>
        </div>
        <div class="entry-buttons">
          <button onclick="editEntry('${e.id}')" class="btn-edit">
            <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
          <button onclick="confirmDeleteEntry('${e.id}')" class="btn-delete">
            <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `).join('');
  
  if (entries.length > 5) {
    const viewMoreButton = `
      <div class="view-more-container">
        <button onclick="toggleViewMore()" class="btn-view-more">
          ${showAllEntries ? 'View Less' : `View All (${entries.length} entries)`}
        </button>
      </div>
    `;
    list.innerHTML += viewMoreButton;
  }
}

function toggleViewMore() {
  showAllEntries = !showAllEntries;
  renderBudgetPage(currentBudgetMonth);
}

function renderBudgetSummaryTable(monthKey) {
  const tableContainer = document.getElementById('budgetSummaryTable');
  if (!tableContainer) return;
  
  const entries = store.entries[monthKey] || [];
  
  if (entries.length === 0) {
    tableContainer.innerHTML = '';
    return;
  }
  
  const categoryTotals = {};
  
  entries.forEach(entry => {
    if (!categoryTotals[entry.category]) {
      categoryTotals[entry.category] = { income: 0, expense: 0 };
    }
    
    if (entry.type === 'income') {
      categoryTotals[entry.category].income += Number(entry.amount);
    } else {
      categoryTotals[entry.category].expense += Number(entry.amount);
    }
  });
  
  let totalIncome = 0;
  let totalExpense = 0;
  
  Object.values(categoryTotals).forEach(totals => {
    totalIncome += totals.income;
    totalExpense += totals.expense;
  });
  
  const sortedCategories = Object.keys(categoryTotals).sort();
  
  tableContainer.innerHTML = `
    <div class="summary-table-container">
      <h3 class="summary-table-title">Monthly Summary</h3>
      <div class="summary-table">
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Income (₹)</th>
              <th>Expense (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${sortedCategories.map(category => {
              const totals = categoryTotals[category];
              return `
                <tr>
                  <td class="category-name">${category}</td>
                  <td class="income-amount">${totals.income > 0 ? formatINR(totals.income) : '-'}</td>
                  <td class="expense-amount">${totals.expense > 0 ? formatINR(totals.expense) : '-'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
          <tfoot>
            <tr class="summary-total">
              <td>TOTAL</td>
              <td class="total-income">${formatINR(totalIncome)}</td>
              <td class="total-expense">${formatINR(totalExpense)}</td>
            </tr>
            <tr class="summary-balance">
              <td>BALANCE</td>
              <td colspan="2" class="balance-amount ${totalIncome - totalExpense >= 0 ? 'positive' : 'negative'}">
                ${formatINR(totalIncome - totalExpense)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;
}

function changeBudgetMonth(direction) {
  const [year, month] = currentBudgetMonth.split('-').map(Number);
  let newMonth = month + direction;
  let newYear = year;
  
  if (newMonth > 12) {
    newMonth = 1;
    newYear++;
  } else if (newMonth < 1) {
    newMonth = 12;
    newYear--;
  }
  
  const newMonthKey = `${newYear}-${String(newMonth).padStart(2, '0')}`;
  showAllEntries = false;
  renderBudgetPage(newMonthKey);
}

// ---------- Entry Modal Functions ----------
function showAddEntryModal() {
  const modal = `
    <div class="modal-content">
      <h3 class="modal-title">Add Entry</h3>
      <form id="entryForm" class="modal-form">
        <div class="form-field">
          <label class="form-label">Type</label>
          <select name="type" required class="form-select">
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </div>
        <div class="form-field">
          <label class="form-label">Amount (₹)</label>
          <input type="number" name="amount" step="0.01" required class="form-input" placeholder="0.00">
          <div class="error-message hidden"></div>
        </div>
        <div class="form-field">
          <label class="form-label">Category</label>
          <select name="category" required class="form-select">
            <option value="">Select Category</option>
            ${store.settings.expenseCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label class="form-label">Description</label>
          <input type="text" name="description" class="form-input" placeholder="Brief description">
        </div>
        <div class="form-field">
          <label class="form-label">Date</label>
          <input type="date" name="date" required class="form-input" value="${new Date().toISOString().split('T')[0]}">
          <div class="error-message hidden"></div>
        </div>
        <div class="form-field">
          <label class="form-label">Note (optional)</label>
          <textarea name="note" rows="3" class="form-textarea" placeholder="Additional notes..."></textarea>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-primary">Add Entry</button>
          <button type="button" onclick="hideModal()" class="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  `;
  
  showModal(modal);
  
  const form = document.getElementById('entryForm');
  
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    
    const entry = {
      type: formData.get('type'),
      amount: parseFloat(formData.get('amount')),
      category: formData.get('category'),
      description: formData.get('description') || '',
      date: formData.get('date'),
      note: formData.get('note') || ''
    };
    
    const fields = [
      { name: 'type', label: 'Type', required: true },
      { name: 'amount', label: 'Amount', required: true, type: 'number' },
      { name: 'category', label: 'Category', required: true },
      { name: 'date', label: 'Date', required: true, type: 'date' }
    ];
    
    const errors = validateForm(entry, fields);
    
    let hasErrors = false;
    Object.keys(errors).forEach(fieldName => {
      const field = form.querySelector(`[name="${fieldName}"]`);
      const errorElement = field?.closest('.form-field')?.querySelector('.error-message');
      if (field && errorElement) {
        errorElement.textContent = errors[fieldName];
        errorElement.classList.remove('hidden');
        field.classList.add('error');
        hasErrors = true;
      }
    });
    
    if (hasErrors) return;
    
    if (addEntry(entry)) {
      hideModal();
      if (activePage === 'home') {
        renderHomePage();
      } else if (activePage === 'budget') {
        renderBudgetPage(currentBudgetMonth);
      }
    }
  });
  
  form.querySelectorAll('input, select, textarea').forEach(input => {
    input.addEventListener('input', () => {
      const errorElement = input.closest('.form-field')?.querySelector('.error-message');
      if (errorElement) {
        errorElement.classList.add('hidden');
        input.classList.remove('error');
      }
    });
  });
}

function editEntry(entryId) {
  let targetEntry = null;
  let monthKey = '';
  
  for (const [key, entries] of Object.entries(store.entries)) {
    const entry = entries.find(e => e.id === entryId);
    if (entry) {
      targetEntry = entry;
      monthKey = key;
      break;
    }
  }
  
  if (!targetEntry) {
    showToast('Entry not found', 'error');
    return;
  }
  
  const modal = `
    <div class="modal-content">
      <h3 class="modal-title">Edit Entry</h3>
      <form id="entryForm" class="modal-form">
        <div class="form-field">
          <label class="form-label">Type</label>
          <select name="type" required class="form-select">
            <option value="income" ${targetEntry.type === 'income' ? 'selected' : ''}>Income</option>
            <option value="expense" ${targetEntry.type === 'expense' ? 'selected' : ''}>Expense</option>
          </select>
        </div>
        <div class="form-field">
          <label class="form-label">Amount (₹)</label>
          <input type="number" name="amount" step="0.01" value="${targetEntry.amount}" required class="form-input" placeholder="0.00">
          <div class="error-message hidden"></div>
        </div>
        <div class="form-field">
          <label class="form-label">Category</label>
          <select name="category" required class="form-select">
            <option value="">Select Category</option>
            ${store.settings.expenseCategories.map(cat => 
              `<option value="${cat}" ${targetEntry.category === cat ? 'selected' : ''}>${cat}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-field">
          <label class="form-label">Description</label>
          <input type="text" name="description" value="${targetEntry.description || ''}" class="form-input" placeholder="Brief description">
        </div>
        <div class="form-field">
          <label class="form-label">Date</label>
          <input type="date" name="date" value="${targetEntry.date}" required class="form-input">
          <div class="error-message hidden"></div>
        </div>
        <div class="form-field">
          <label class="form-label">Note (optional)</label>
          <textarea name="note" rows="3" class="form-textarea" placeholder="Additional notes...">${targetEntry.note || ''}</textarea>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-primary">Update Entry</button>
          <button type="button" onclick="hideModal()" class="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  `;
  
  showModal(modal);
  
  const form = document.getElementById('entryForm');
  
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    
    const updates = {
      type: formData.get('type'),
      amount: parseFloat(formData.get('amount')),
      category: formData.get('category'),
      description: formData.get('description') || '',
      date: formData.get('date'),
      note: formData.get('note') || ''
    };
    
    const fields = [
      { name: 'type', label: 'Type', required: true },
      { name: 'amount', label: 'Amount', required: true, type: 'number' },
      { name: 'category', label: 'Category', required: true },
      { name: 'date', label: 'Date', required: true, type: 'date' }
    ];
    
    const errors = validateForm(updates, fields);
    
    let hasErrors = false;
    Object.keys(errors).forEach(fieldName => {
      const field = form.querySelector(`[name="${fieldName}"]`);
      const errorElement = field?.closest('.form-field')?.querySelector('.error-message');
      if (field && errorElement) {
        errorElement.textContent = errors[fieldName];
        errorElement.classList.remove('hidden');
        field.classList.add('error');
        hasErrors = true;
      }
    });
    
    if (hasErrors) return;
    
    if (updateEntry(entryId, updates)) {
      hideModal();
      if (activePage === 'home') {
        renderHomePage();
      } else if (activePage === 'budget') {
        renderBudgetPage(currentBudgetMonth);
      } else if (activePage === 'savings') {
        renderSavingsPage();
      }
    }
  });
  
  form.querySelectorAll('input, select, textarea').forEach(input => {
    input.addEventListener('input', () => {
      const errorElement = input.closest('.form-field')?.querySelector('.error-message');
      if (errorElement) {
        errorElement.classList.add('hidden');
        input.classList.remove('error');
      }
    });
  });
}

function confirmDeleteEntry(entryId) {
  showConfirmationModal(
    'Delete Entry',
    'Are you sure you want to delete this entry? This action cannot be undone.',
    `deleteEntryConfirmed('${entryId}')`
  );
}

function deleteEntryConfirmed(entryId) {
  if (deleteEntry(entryId)) {
    if (activePage === 'home') {
      renderHomePage();
    } else if (activePage === 'budget') {
      renderBudgetPage(currentBudgetMonth);
    } else if (activePage === 'savings') {
      renderSavingsPage();
    }
  }
}

// ---------- Sidebar Toggle ----------
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  
  sidebar.classList.toggle('hidden');
  
  if (window.innerWidth < 768) {
    if (!sidebar.classList.contains('hidden')) {
      const backdrop = document.createElement('div');
      backdrop.id = 'mobileBackdrop';
      backdrop.className = 'mobile-backdrop';
      backdrop.addEventListener('click', toggleSidebar);
      document.body.appendChild(backdrop);
    } else {
      const backdrop = document.getElementById('mobileBackdrop');
      if (backdrop) backdrop.remove();
    }
  }
}

// ---------- Initialize App ----------
function initApp() {
  setupEventListeners();
  
  currentBudgetMonth = getMonthKey(new Date());
  currentChartStart = getMonthKey(new Date());
  homeChartCurrentMonth = getMonthKey(new Date());
  
  showPage('home');
  
  document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('sidebar');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    
    if (window.innerWidth < 768 && 
        sidebar && 
        !sidebar.contains(e.target) && 
        mobileMenuBtn &&
        !mobileMenuBtn.con// ---------- Global Functions ----------
window.showPage = showPage;
window.toggleSidebar = toggleSidebar;
window.showAddEntryModal = showAddEntryModal;
window.exportData = exportData;
window.hideModal = hideModal;
window.showModal = showModal;
window.showToast = showToast;
window.editEntry = editEntry;
window.confirmDeleteEntry = confirmDeleteEntry;
window.deleteEntryConfirmed = deleteEntryConfirmed;
window.changeBudgetMonth = changeBudgetMonth;
window.switchHomeCategory = switchHomeCategory;
window.navigateChartWindow = navigateChartWindow;
window.navigateToCurrentMonthBudget = navigateToCurrentMonthBudget;
window.toggleViewMore = toggleViewMore;
window.navigateHomeChartMonths = navigateHomeChartMonths;
window.showAddLoanModal = showAddLoanModal;
window.showEditLoanModal = showEditLoanModal;
window.showAddPaymentModal = showAddPaymentModal;
window.confirmDeleteLoan = confirmDeleteLoan;
window.deleteLoanConfirmed = deleteLoanConfirmed;
window.showAddGoalModal = showAddGoalModal;
window.showEditGoalModal = showEditGoalModal;
window.showAddSavingsToGoalModal = showAddSavingsToGoalModal;
window.confirmDeleteGoal = confirmDeleteGoal;
window.deleteGoalConfirmed = deleteGoalConfirmed;
window.showAddSavingsModal = showAddSavingsModal;
window.removeCustomCategory = removeCustomCategory;
window.confirmClearData = confirmClearData;
window.clearAllDataConfirmed = clearAllDataConfirmed;t Listeners ----------
function setupEventListeners() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.getAttribute('data-page');
      showPage(page);
    });
  });

  const budgetPrev = document.getElementById('budgetPrev');
  const budgetNext = document.getElementById('budgetNext');
  if (budgetPrev) budgetPrev.addEventListener('click', () => changeBudgetMonth(-1));
  if (budgetNext) budgetNext.addEventListener('click', () => changeBudgetMonth(1));

  const addEntryBtn = document.getElementById('addEntryBtn');
  if (addEntryBtn) addEntryBtn.addEventListener('click', showAddEntryModal);

  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleSidebar);

  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) exportBtn.addEventListener('click', exportData);

  const importBtn = document.getElementById('importBtn');
  const importInput = document.getElementById('importInput');
  if (importBtn && importInput) {
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', function() {
      handleImportFile(this);
    });
  }

  const modalRoot = document.getElementById('modalRoot');
  if (modalRoot) {
    modalRoot.addEventListener('click', (e) => {
      if (e.target === modalRoot) {
        hideModal();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideModal();
    }
  });
}

// ---------- Global Functions ----------
window.showPage = showPage;
window.toggleSidebar = toggleSidebar;
window.showAddEntryModal = showAddEntryModal;
window.exportData = exportData;
window.hideModal = hideModal;
window.showModal = showModal;
window.showToast = showToast;
window.editEntry = editEntry;
window.confirmDeleteEntry = confirmDeleteEntry;
window.deleteEntryConfirmed = deleteEntryConfirmed;
window.changeBudgetMonth = changeBudgetMonth;
window.switchHomeCategory = switchHomeCategory;
window.navigateChartWindow = navigateChartWindow;
window.navigateToCurrentMonthBudget = navigateToCurrentMonthBudget;
window.toggleViewMore = toggleViewMore;
window.navigateHomeChartMonths = navigateHomeChartMonths;

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);

______________________________________________________________
// Add these missing helper functions
function showEditLoanModal(loanId) {
  const loan = store.loans.find(l => l.id === loanId);
  if (!loan) return;
  
  const modal = `
    <div class="modal-content">
      <h3 class="modal-title">Edit Loan</h3>
      <form id="loanForm" class="modal-form">
        <div class="form-field">
          <label class="form-label">Loan Name</label>
          <input type="text" name="name" value="${loan.name}" required class="form-input">
        </div>
        <div class="form-field">
          <label class="form-label">Lender</label>
          <input type="text" name="lender" value="${loan.lender || ''}" class="form-input">
        </div>
        <div class="form-field">
          <label class="form-label">Principal Amount (₹)</label>
          <input type="number" name="principal" value="${loan.principal}" step="0.01" required class="form-input">
        </div>
        <div class="form-field">
          <label class="form-label">Paid Amount (₹)</label>
          <input type="number" name="paidAmount" value="${loan.paidAmount || 0}" step="0.01" class="form-input">
        </div>
        <div class="form-field">
          <label class="form-label">Due Date (optional)</label>
          <input type="date" name="dueDate" value="${loan.dueDate || ''}" class="form-input">
        </div>
        <div class="form-field">
          <label class="form-label">Notes (optional)</label>
          <textarea name="notes" rows="3" class="form-textarea">${loan.notes || ''}</textarea>
        </div>
        <div class="modal-actions">
          <button type="submit" class="btn-primary">Update Loan</button>
          <button type="button" onclick="hideModal()" class="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  `;
  
  showModal(modal);
  
  const form = document.getElementById('loanForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    
    const updates = {
      name: formData.get('name'),
      lender: formData.get('lender'),
      principal: parseFloat(formData.get('principal')),
      paidAmount: parseFloat(formData.get('paidAmount')) || 0,
      dueDate: formData.get('dueDate') || null,
      notes: formData.get('notes') || ''
    };
    
    if (updateLoan(loanId, updates)) {
      hideModal();
      renderLoansPage();
      if (activePage === 'home') {
        renderHomePage();
      }
    }
  });
}

function showAddPaymentModal(loanId) {
  const loan = store.loans.find(l => l.id === loanId);
  if (!loan) return;
  
  const remaining = loan.principal - (loan.paidAmount || 0);
  
  const modal = `
    <div class="modal-content">
      <h3 class="modal-title">Add Payment</h3>
      <p class="modal-message">Remaining amount: <strong>${formatINR(remaining)}</strong></p>
      <form id="paymentForm" class="modal-form">
        <div class="form-field">
          <label class="form-label">Payment Amount (₹)</label>
          <input type="number" name="amount" step="0.01" max="${remaining}" required class="form-input" placeholder="0.00">
        </div>
        <div class="form-field">
          <label class="form-label">Payment Date</label>
          <input type="date" name="date" required class="form-input" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-field">
          <label class="form-label">Notes (optional)</label>
          <textarea name="notes" rows="3" class="form-textarea" placeholder="Payment notes..."></textarea>
        </div>
        <div class="modal-actions">
          <button type="submit" class="btn-primary">Record Payment</button>
          <button type="button" onclick="hideModal()" class="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  `;
  
  showModal(modal);
  
  const form = document.getElementById('paymentForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    
    const paymentAmount = parseFloat(formData.get('amount'));
    const newPaidAmount = (loan.paidAmount || 0) + paymentAmount;
    
    if (newPaidAmount > loan.principal) {
      showToast('Payment amount exceeds remaining balance', 'error');
      return;
    }
    
    const updates = {
      paidAmount: newPaidAmount
    };
    
    if (updateLoan(loanId, updates)) {
      // Also create an expense entry for the payment
      const paymentEntry = {
        type: 'expense',
        category: 'Loan Payment',
        description: `Payment for ${loan.name}`,
        amount: paymentAmount,
        date: formData.get('date'),
        note: `Loan payment to ${loan.lender || 'lender'}. ${formData.get('notes') || ''}`
      };function showAddSavingsToGoalModal(goalId) {
  const goal = store.goals.find(g => g.id === goalId);
  if (!goal) return;
  
  const progress = getGoalProgress(goal);
  const remaining = goal.targetAmount * (1 - progress / 100);
  
  const modal = `
    <div class="modal-content">
      <h3 class="modal-title">Add Savings to Goal</h3>
      <p class="modal-message">Goal: <strong>${goal.title}</strong></p>
      <p class="modal-message">Remaining amount: <strong>${formatINR(remaining)}</strong></p>
      <form id="savingsForm" class="modal-form">
        <div class="form-field">
          <label class="form-label">Savings Amount (₹)</label>
          <input type="number" name="amount" step="0.01" max="${remaining}" required class="form-input" placeholder="0.00">
        </div>
        <div class="form-field">
          <label class="form-label">Date</label>
          <input type="date" name="date" required class="form-input" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-field">
          <label class="form-label">Note (optional)</label>
          <textarea name="note" rows="3" class="form-textarea" placeholder="Savings notes..."></textarea>
        </div>
        <div class="modal-actions">
          <button type="submit" class="btn-primary">Add Savings</button>
          <button type="button" onclick="hideModal()" class="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  `;
  
  showModal(modal);
  
  const form = document.getElementById('savingsForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    
    const amount = parseFloat(formData.get('amount'));
    const description = `Savings for goal: ${goal.title}`;
    const date = formData.get('date');
    const note = formData.get('note') || '';
    
    if (addSavings(amount, description, date, note)) {
      hideModal();
      renderGoalsPage();
      if (activePage === 'home') {
        renderHomePage();
      }
    }
  });
}

function renderSavingsHistoryChart(savingsData) {
  const ctx = document.getElementById('savingsHistoryChart');
  if (!ctx) return;

  if (savingsChartInstance) {
    savingsChartInstance.destroy();
    savingsChartInstance = null;
  }

  const hasData = savingsData.some(d => d.savings > 0);
  
  if (!hasData) {
    const chartContainer = ctx.closest('.savings-chart-card');
    if (chartContainer) {
      chartContainer.innerHTML = `
        <div class="section-header">
          <h3 class="section-title">Savings History</h3>
          <button onclick="showAddSavingsModal()" class="primary-btn">Add Savings</button>
        </div>
        <div class="empty-chart-state">
          <div class="empty-chart-icon">💾</div>
          <h3 class="empty-chart-title">No Savings Data</h3>
          <p class="empty-chart-message">Start adding savings to see your progress over time</p>
          <button onclick="showAddSavingsModal()" class="empty-chart-button">
            Add Your First Savings
          </button>
        </div>
      `;
    }
    return;
  }

  savingsChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: savingsData.map(d => d.label),
      datasets: [
        {
          label: 'Monthly Savings',
          data: savingsData.map(d => d.savings),
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderColor: 'rgba(16, 185, 129, 1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: 'rgba(16, 185, 129, 1)',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: value => formatINR(value)
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.1)'
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: context => 'Savings: ' + formatINR(context.parsed.y)
          }
        },
        legend: {
          display: false
        }
      }
    }
  });
}

function renderSavingsEntriesList() {
  const list = document.getElementById('savingsEntriesList');
  if (!list) return;
  
  const savingsEntries = Object.values(store.entries)
    .flat()
    .filter(e => e.type === 'expense' && e.category === 'Savings')
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10);
  
  if (savingsEntries.length === 0) {
    list.innerHTML = '<div class="empty-transactions">No savings entries yet. Add savings to see them here.</div>';
    return;
  }
  
  list.innerHTML = savingsEntries.map(entry => `
    <div class="transaction-item">
      <div class="transaction-info">
        <div class="transaction-description">${entry.description || 'Savings'}</div>
        <div class="transaction-meta">${new Date(entry.date).toLocaleDateString('en-IN')}${entry.note ? ` • ${entry.note}` : ''}</div>
      </div>
      <div class="transaction-amount savings">
        ${formatINR(entry.amount)}
        <div class="transaction-type">savings</div>
      </div>
    </div>
  `).join('');
}

function confirmDeleteGoal(goalId) {
  showConfirmationModal(
    'Delete Goal',
    'Are you sure you want to delete this goal? This action cannot be undone.',
    `deleteGoalConfirmed('${goalId}')`
  );
}

function deleteGoalConfirmed(goalId) {
  if (deleteGoal(goalId)) {
    renderGoalsPage();
    if (activePage === 'home') {
      renderHomePage();
    }
  }
}

function removeCustomCategory(category) {
  const defaultCategories = getDefaultCategories();
  if (defaultCategories.includes(category)) {
    showToast('Cannot remove default categories', 'error');
    return;
  }
  
  const index = store.settings.expenseCategories.indexOf(category);
  if (index > -1) {
    store.settings.expenseCategories.splice(index, 1);
    if (saveStore(store)) {
      renderSettingsPage();
      showToast('Category removed successfully', 'success');
    }
  }
}

function confirmClearData() {
  showConfirmationModal(
    'Clear All Data',
    'This will permanently delete all your budget data, including entries, goals, loans, and settings. This action cannot be undone. Are you sure?',
    'clearAllDataConfirmed'
  );
}

function clearAllDataConfirmed() {
  localStorage.removeItem(STORAGE_KEY);
  showToast('All data cleared successfully', 'success');
  setTimeout(() => {
    location.reload();
  }, 1000);
}

function handleImportFile(input) {
  const file = input.files[0];
  if (!file) return;
  
  if (file.type !== 'application/json') {
    showToast('Please select a valid JSON file', 'error');
    return;
  }
  
  importData(file, false);
  input.value = '';
}
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    
    const updates = {
      title: formData.get('title'),
      description: formData.get('description') || '',
      targetAmount: parseFloat(formData.get('targetAmount')),
      targetDate: formData.get('targetDate')
    };
    
    if (updateGoal(goalId, updates)) {
      hideModal();
      renderGoalsPage();
      if (activePage === 'home') {
        renderHomePage();
      }
    }
  });
}

function showAddSavingsToGoalModal(goalId) {
  const goal = store.goals.find(g => g.id === goalId);
  if (!goal) return;
  
  const progress = getGoalProgress(goal);
  const remaining = goal.targetAmount * (1 - progress / 100);
  
  const modal = `
    <div class="modal-content">
      <h3 class="modal-title">Add Savings to Goal</h3>
      <p class="modal-message">Goal: <strong>${goal.title}</strong></p>
      <p class="modal-message">Remaining amount: <strong>${formatINR(remaining)}</strong></p>
      <form id="savingsForm" class="modal-form">
        <div class="form-field">
          <label class="form-label">Savings Amount (₹)</label>
          <input type="number" name="amount" step="0.01" max="${remaining}" required class="form-input" placeholder="0.00">
        </div>
        <div class="form-field">
          <label class="form-label">Date</label>
          <input type="date" name="date" required class="form-input" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-field">
          <label class="form-label">Note (optional)</label>
          <textarea name="note" rows="3" class="form-textarea" placeholder="Savings notes..."></textarea>
        </div>
        <div class="modal-actions">
          <button type="submit" class="btn-primary">Add Savings</button>
          <button type="button" onclick="hideModal()" class="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  `;
  
  showModal(modal);
  
  const form = document.getElementById('savingsForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    
    const amount = parseFloat(formData.get('amount'));
    const description = `Savings for goal: ${goal.title}`;
    const date = formData.get('date');
    const note = formData.get('note') || '';
    
    if (addSavings(amount, description, date, note)) {
      hideModal();
      renderGoalsPage();
      if (activePage === 'home') {
        renderHomePage();
      }
    }
  });
}
