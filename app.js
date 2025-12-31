/* ===========================================================
   app.js — Personal Budget App (Enhanced with Home Dashboard)
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

// ---------- Data Store ----------
function getDefaultCategories() {
  return [
    'Home Loan',
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
    'EMI',
    'Credit Card',
    'Miscellaneous'
  ];
}

function loadStore() {
  let data = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (!data) {
    data = {
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
    saveStore(data);
  }
  return data;
}

function saveStore(data) {
  data.meta.lastUpdated = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

let store = loadStore();

// ---------- CRUD for Entries ----------
function addEntry(entry) {
  const key = getMonthKey(entry.date);
  if (!store.entries[key]) store.entries[key] = [];
  entry.id = uuid();
  entry.createdAt = new Date().toISOString();
  entry.updatedAt = entry.createdAt;
  store.entries[key].push(entry);
  saveStore(store);
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
      saveStore(store);
      return;
    }
  }
}

function deleteEntry(entryId) {
  for (const [monthKey, arr] of Object.entries(store.entries)) {
    const idx = arr.findIndex(e => e.id === entryId);
    if (idx !== -1) {
      arr.splice(idx, 1);
      saveStore(store);
      return;
    }
  }
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

function getExpensesSeriesForWindow(startMonthKey, monthsCount = 6) {
  const [y, m] = startMonthKey.split('-').map(Number);

  // ALWAYS treat startMonthKey as the "current" month
  const current = new Date(y, m - 1);
  const result = [];

  // We now move BACKWARD instead of forward
  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = new Date(current.getFullYear(), current.getMonth() - i);
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
function addSavings(amount, description, date) {
  const entry = {
    id: uuid(),
    date,
    amount: Number(amount),
    type: 'expense',
    category: 'Savings',
    description,
    note: '',
    monthKey: getMonthKey(date),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  addEntry(entry);
}

// ---------- Loans ----------
function addLoan(loan) {
  loan.id = uuid();
  loan.createdAt = new Date().toISOString();
  store.loans.push(loan);
  saveStore(store);
}

function updateLoan(id, updates) {
  const idx = store.loans.findIndex(l => l.id === id);
  if (idx !== -1) {
    store.loans[idx] = { ...store.loans[idx], ...updates };
    saveStore(store);
  }
}

function deleteLoan(id) {
  const idx = store.loans.findIndex(l => l.id === id);
  if (idx !== -1) {
    store.loans.splice(idx, 1);
    saveStore(store);
  }
}

// ---------- Goals ----------
function addGoal(goal) {
  goal.id = uuid();
  goal.createdAt = new Date().toISOString();
  store.goals.push(goal);
  saveStore(store);
}

function updateGoal(id, updates) {
  const idx = store.goals.findIndex(g => g.id === id);
  if (idx !== -1) {
    store.goals[idx] = { ...store.goals[idx], ...updates };
    saveStore(store);
  }
}

function deleteGoal(id) {
  const idx = store.goals.findIndex(g => g.id === id);
  if (idx !== -1) {
    store.goals.splice(idx, 1);
    saveStore(store);
  }
}

function getGoalProgress(goal) {
  const totalSavings = Object.values(store.entries)
    .flat()
    .filter(
      e =>
        e.type === 'expense' &&
        e.category.toLowerCase() === 'savings' &&
        e.description.toLowerCase().includes(goal.title.toLowerCase())
    )
    .reduce((sum, e) => sum + Number(e.amount), 0);
  return Math.min((totalSavings / goal.targetAmount) * 100, 100);
}

// ---------- Chart Instances ----------
let chartInstance;
let savingsChartInstance = null;
let currentChartStart = getMonthKey(new Date());
let homeActiveCategory = 'budget';

// ---------- Enhanced Home Page Functions ----------
function renderHomePage() {
  renderHomeCategoryButtons();
  renderHomeCategoryContent();
  renderRecentTransactions();
}

function renderHomeCategoryButtons() {
  const chartContainer = document.getElementById('expensesChartContainer');
  if (!chartContainer) return;

  let buttonsContainer = document.getElementById('homeCategoryButtons');
  if (!buttonsContainer) {
    buttonsContainer = document.createElement('div');
    buttonsContainer.id = 'homeCategoryButtons';
    buttonsContainer.className = 'flex gap-3 mb-6 justify-center flex-wrap';
    chartContainer.parentNode.insertBefore(buttonsContainer, chartContainer);
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
      class="px-6 py-3 rounded-lg font-medium transition-all border-2 ${
        homeActiveCategory === cat.id 
          ? 'bg-primary-600 text-white border-primary-600 shadow-lg' 
          : 'bg-white text-gray-700 border-gray-300 hover:border-primary-500 hover:bg-gray-50'
      }"
    >
      ${cat.label}
    </button>
  `).join('');
}

function switchHomeCategory(category) {
  homeActiveCategory = category;
  renderHomeCategoryButtons();
  renderHomeCategoryContent();
}

function renderHomeCategoryContent() {
  const chartContainer = document.getElementById('expensesChartContainer');
  if (!chartContainer) return;

  const buttonsContainer = document.getElementById('homeCategoryButtons');
  chartContainer.innerHTML = '';
  
  document.querySelectorAll('#expensesChartContainer canvas').forEach(canvas => canvas.remove());

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
  
  // Clear and create new structure with fixed height
  chartContainer.innerHTML = `
  <div class="h-96 relative">
      <div id="svgChartContainer"></div>
  </div>
`;
  
  const currentMonth = getMonthKey(new Date());
  
  // Render chart after DOM update
  setTimeout(() => {
  const dataSeries = getExpenseSavingsSeries(currentMonth, 6);
  renderExpensesSVGChart(dataSeries);
}, 50);
}

function renderLoansHomeContent() {
  const chartContainer = document.getElementById('expensesChartContainer');
  const loans = store.loans;

  if (loans.length === 0) {
    chartContainer.innerHTML = `
      <div class="text-center p-8 text-gray-500">
        <p>No loans tracked yet.</p>
        <p class="text-sm mt-2">Add loans in the Loans section to see progress here.</p>
      </div>
    `;
    return;
  }

  chartContainer.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      ${loans.map(loan => {
        const paid = loan.paidAmount || 0;
        const remaining = loan.principal - paid;
        const progress = (paid / loan.principal) * 100;
        
        return `
          <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div class="flex justify-between items-start mb-4">
              <div>
                <h3 class="font-semibold text-lg text-gray-900">${loan.name}</h3>
                <p class="text-sm text-gray-500">${loan.lender || 'No lender specified'}</p>
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div class="text-xs text-gray-500">Principal</div>
                <div class="font-semibold text-gray-900">${formatINR(loan.principal)}</div>
              </div>
              <div>
                <div class="text-xs text-gray-500">Paid</div>
                <div class="font-semibold text-green-600">${formatINR(paid)}</div>
              </div>
              <div>
                <div class="text-xs text-gray-500">Remaining</div>
                <div class="font-semibold text-red-600">${formatINR(remaining)}</div>
              </div>
              <div>
                <div class="text-xs text-gray-500">Progress</div>
                <div class="font-semibold text-primary-600">${progress.toFixed(1)}%</div>
              </div>
            </div>
            
            <div class="flex justify-center">
              <div class="relative w-32 h-32">
                <svg class="w-full h-full" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#eee"
                    stroke-width="3"
                  />
                  <path
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#4f46e5"
                    stroke-width="3"
                    stroke-dasharray="${progress}, 100"
                    transform="rotate(-90 18 18)"
                  />
                  <text x="18" y="20.5" text-anchor="middle" font-size="8" fill="#4f46e5" font-weight="bold">
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
  
  // Clear existing content
  chartContainer.innerHTML = '';
  
  const currentMonth = getMonthKey(new Date());
  const currentMonthSavings = getSavingsForMonth(currentMonth);
  const totalSavings = getTotalSavings();
  const savingsByMonth = getSavingsByMonth(12);

  // Create the savings content with fixed height container
  chartContainer.innerHTML = `
    <div class="mb-6">
      <div class="grid grid-cols-2 gap-4">
        <div class="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
          <div class="text-sm text-gray-600 font-medium">This Month's Savings</div>
          <div class="text-2xl font-bold text-green-700 mt-1">${formatINR(currentMonthSavings)}</div>
        </div>
        <div class="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-xl border border-blue-200">
          <div class="text-sm text-gray-600 font-medium">Total Savings</div>
          <div class="text-2xl font-bold text-blue-700 mt-1">${formatINR(totalSavings)}</div>
        </div>
      </div>
    </div>
    
    <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h3 class="text-lg font-semibold mb-4">Savings Over Time</h3>
      <div class="h-80"> <!-- Fixed height container -->
        <canvas id="savingsChart"></canvas>
      </div>
    </div>
  `;
  
  // Render the chart after a small delay to ensure DOM is ready
  setTimeout(() => {
    renderSavingsChart(savingsByMonth);
  }, 50);
}

function renderGoalsHomeContent() {
  const chartContainer = document.getElementById('expensesChartContainer');
  const goals = store.goals;

  if (goals.length === 0) {
    chartContainer.innerHTML = `
      <div class="text-center p-8 text-gray-500">
        <p>No goals set yet.</p>
        <p class="text-sm mt-2">Add goals in the Goals section to track progress here.</p>
      </div>
    `;
    return;
  }

  chartContainer.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      ${goals.map(goal => {
        const progress = getGoalProgress(goal);
        const targetDate = new Date(goal.targetDate);
        const isOverdue = targetDate < new Date();
        
        return `
          <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div class="flex justify-between items-start mb-4">
              <div>
                <h3 class="font-semibold text-lg text-gray-900">${goal.title}</h3>
                <p class="text-sm text-gray-500">${goal.description || 'No description'}</p>
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div class="text-xs text-gray-500">Target Amount</div>
                <div class="font-semibold text-gray-900">${formatINR(goal.targetAmount)}</div>
              </div>
              <div>
                <div class="text-xs text-gray-500">Target Date</div>
                <div class="font-semibold ${isOverdue ? 'text-red-600' : 'text-gray-900'}">
                  ${targetDate.toLocaleDateString('en-IN')}
                </div>
              </div>
            </div>
            
            <div class="flex justify-center">
              <div class="relative w-32 h-32">
                <svg class="w-full h-full" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#eee"
                    stroke-width="3"
                  />
                  <path
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#10b981"
                    stroke-width="3"
                    stroke-dasharray="${progress}, 100"
                    transform="rotate(-90 18 18)"
                  />
                  <text x="18" y="20.5" text-anchor="middle" font-size="8" fill="#10b981" font-weight="bold">
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

// ---------- New Helper Functions for Home Dashboard ----------
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

  // Destroy existing chart instance
  if (savingsChartInstance) {
    savingsChartInstance.destroy();
    savingsChartInstance = null;
  }

  // Check if there's any savings data to display
  const hasData = savingsData.some(d => d.savings > 0);
  
  if (!hasData) {
    // Remove any existing canvas and show message
    const chartContainer = document.getElementById('expensesChartContainer');
    const existingCanvas = document.getElementById('savingsChart');
    if (existingCanvas) {
      existingCanvas.remove();
    }
    
    // Show help message
    const messageDiv = document.createElement('div');
    messageDiv.className = 'text-center py-12';
    messageDiv.innerHTML = `
      <div class="text-gray-400 text-6xl mb-4">💾</div>
      <h3 class="text-lg font-semibold text-gray-700 mb-2">No Savings Data</h3>
      <p class="text-gray-500">Please add your savings details in the Savings section</p>
      <button onclick="showPage('savings')" class="mt-4 bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
        Go to Savings
      </button>
    `;
    
    // Find and replace the chart container content
    const chartParent = ctx.closest('.bg-white');
    if (chartParent) {
      const chartSection = chartParent.querySelector('canvas')?.parentElement || chartParent;
      chartSection.innerHTML = '';
      chartSection.appendChild(messageDiv);
    }
    return;
  }

  // Create new chart with fixed dimensions
  savingsChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: savingsData.map(d => d.label),
      datasets: [
        {
          label: 'Monthly Savings',
          data: savingsData.map(d => d.savings),
          backgroundColor: 'rgba(16, 185, 129, 0.7)',
          borderColor: 'rgba(16, 185, 129, 1)',
          borderWidth: 1,
          borderRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      aspectRatio: 2, // Fixed aspect ratio to prevent infinite growth
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: value => formatINR(value)
          },
          grid: {
            drawBorder: false
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
      },
      layout: {
        padding: {
          top: 10,
          bottom: 10,
          left: 10,
          right: 10
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
          backgroundColor: 'rgba(79, 70, 229, 0.7)',
          borderColor: 'rgba(79, 70, 229, 1)',
          borderWidth: 1,
          borderRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false, // This is key - prevents automatic resizing
      aspectRatio: 2.5, // Optimal ratio for bar charts (width:height)
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: value => formatINR(value)
          },
          grid: {
            drawBorder: false
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
      },
      layout: {
        padding: {
          top: 10,
          bottom: 10,
          left: 10,
          right: 10
        }
      }
    }
  });
}

function renderExpensesSVGChart(dataSeries) {
  const container = document.getElementById("svgChartContainer");
  if (!container) return;

  const width = 540;
  const height = 290;

  const padding = {
    top: 40,
    right: 30,
    bottom: 50,
    left: 60
  };

  const graphW = width - padding.left - padding.right;
  const graphH = height - padding.top - padding.bottom;

  const maxValue = Math.max(
    ...dataSeries.map(d => Math.max(d.expense, d.savings)),
    1
  );

  const stepX = graphW / (dataSeries.length - 1);

  //-----------------------------
  //  Build line points (EXPENSE)
  //-----------------------------
  let expensePoints = "";
  dataSeries.forEach((d, i) => {
    const x = padding.left + i * stepX;
    const y = padding.top + (1 - d.expense / maxValue) * graphH;
    expensePoints += `${x},${y} `;
  });

  //-----------------------------
  //  Build line points (SAVINGS)
  //-----------------------------
  let savingsPoints = "";
  dataSeries.forEach((d, i) => {
    const x = padding.left + i * stepX;
    const y = padding.top + (1 - d.savings / maxValue) * graphH;
    savingsPoints += `${x},${y} `;
  });

  //-----------------------------
  //  Y-axis ticks + grid
  //-----------------------------
  const yTicks = 5;
  let yAxisLabels = "";
  let gridLines = "";

  for (let i = 0; i <= yTicks; i++) {
    const value = Math.round((maxValue / yTicks) * i);
    const y = padding.top + graphH - (graphH * (i / yTicks));

    yAxisLabels += `
      <text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" font-size="10" fill="#999">₹${value}</text>
    `;

    gridLines += `
      <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" 
            stroke="#ccc" stroke-width="1" opacity="0.2"></line>
    `;
  }

  //-----------------------------
  //  X-axis labels (Months)
  //-----------------------------
  let xAxisLabels = "";
  dataSeries.forEach((d, i) => {
    const x = padding.left + i * stepX;
    const date = new Date(d.monthKey + "-01");
    const label = date.toLocaleString("en-IN", { month: "short" });

    xAxisLabels += `
      <text x="${x}" y="${height - padding.bottom + 20}" 
            text-anchor="middle" font-size="10" fill="#999">${label}</text>
    `;
  });

  //-----------------------------
  //  Legend
  //-----------------------------
  const legend = `
      <rect x="${padding.left}" y="5" width="12" height="12" fill="#FF6B6B"></rect>
      <text x="${padding.left + 20}" y="15" font-size="11" fill="#333">Expenses</text>

      <rect x="${padding.left + 100}" y="5" width="12" height="12" fill="#5BCAC1"></rect>
      <text x="${padding.left + 120}" y="15" font-size="11" fill="#333">Savings</text>
  `;

  //-----------------------------
  //  Final SVG
  //-----------------------------
  container.innerHTML = `
    <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}">
      
      ${legend}

      ${gridLines}

      <line x1="${padding.left}" y1="${padding.top}" 
            x2="${padding.left}" y2="${height - padding.bottom}" 
            stroke="#999" stroke-width="1"/>

      <line x1="${padding.left}" y1="${height - padding.bottom}" 
            x2="${width - padding.right}" y2="${height - padding.bottom}" 
            stroke="#999" stroke-width="1"/>

      ${yAxisLabels}
      ${xAxisLabels}

      <!-- EXPENSE LINE (RED) -->
<polyline 
    points="${expensePoints}"
    stroke="#FF6B6B"
    fill="none"
    stroke-width="6"
    stroke-linecap="round"
    stroke-linejoin="round"
    style="stroke-dasharray: 1000; stroke-dashoffset: 1000;
           animation: dash 2.5s ease forwards;"
></polyline>

<!-- SAVINGS LINE (BLUE) -->
<polyline 
    points="${savingsPoints}"
    stroke="#4FC3F7"
    fill="none"
    stroke-width="6"
    stroke-linecap="round"
    stroke-linejoin="round"
    style="stroke-dasharray: 1000; stroke-dashoffset: 1000;
           animation: dash 2.5s ease forwards;"
></polyline>

      <style>
        @keyframes dash { to { stroke-dashoffset: 0; } }
      </style>

    </svg>
  `;
}


function getExpenseSavingsSeries(startMonthKey, monthsCount = 6) {
  const [y, m] = startMonthKey.split('-').map(Number);
  const start = new Date(y, m - 1);

  const result = [];

  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = new Date(start.getFullYear(), start.getMonth() - i);
    const key = getMonthKey(d);

    const expense =
      (store.entries[key] || [])
        .filter(e => e.type === 'expense')
        .reduce((sum, e) => sum + Number(e.amount), 0);

    const savings =
      (store.entries[key] || [])
        .filter(e => e.type === 'expense' && e.category === 'Savings')
        .reduce((sum, e) => sum + Number(e.amount), 0);

    result.push({ monthKey: key, expense, savings });
  }

  return result;
}



// ---------- Import / Export ----------
function exportData() {
  const data = JSON.stringify(store, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `budget-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
}

function importData(file, merge = false) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const imported = JSON.parse(e.target.result);
      if (merge) {
        Object.assign(store.entries, imported.entries || {});
        store.settings.expenseCategories = Array.from(
          new Set([
            ...store.settings.expenseCategories,
            ...(imported.settings?.expenseCategories || [])
          ])
        );
        store.goals.push(...(imported.goals || []));
        store.loans.push(...(imported.loans || []));
      } else {
        store = imported;
      }
      saveStore(store);
      alert('Import successful!');
      location.reload();
    } catch {
      alert('Invalid JSON data.');
    }
  };
  reader.readAsText(file);
}

// ---------- Modal System ----------
function showModal(content) {
  const modalRoot = document.getElementById('modalRoot');
  modalRoot.innerHTML = content;
  modalRoot.classList.remove('hidden');
  modalRoot.classList.add('flex');
}

function hideModal() {
  const modalRoot = document.getElementById('modalRoot');
  modalRoot.classList.add('hidden');
  modalRoot.classList.remove('flex');
  modalRoot.innerHTML = '';
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
  
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('bg-white/20', 'shadow-sm');
  });
  
  const activeBtn = document.querySelector(`[data-page="${pageName}"]`);
  if (activeBtn) {
    activeBtn.classList.add('bg-white/20', 'shadow-sm');
  }
  
  if (pageName === 'home') {
    homeActiveCategory = 'budget';
    renderHomePage();
    updateHomeOverviewCard();
  } else if (pageName === 'budget') {
    renderBudgetPage(currentBudgetMonth);
  } else if (pageName === 'savings') {
    renderSavingsPage();
  } else if (pageName === 'loans') {
    renderLoansPage();
  } else if (pageName === 'goals') {
    renderGoalsPage();
  }
}

// ---------- Recent Transactions ----------
function renderRecentTransactions() {
  const list = document.getElementById('recentList');
  if (!list) return;
  
  const txns = getRecentTransactions(10);
  
  if (txns.length === 0) {
    list.innerHTML = '<div class="p-6 text-center text-gray-500">No transactions yet. Add entries in the Budget page.</div>';
    return;
  }
  
  list.innerHTML = txns.map(t => `
    <div class="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
      <div class="flex-1">
        <div class="font-medium text-gray-900">${t.description || t.category}</div>
        <div class="text-sm text-gray-500">${new Date(t.date).toLocaleDateString('en-IN')} • ${t.category}</div>
      </div>
      <div class="text-right">
        <div class="font-semibold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}">
          ${t.type === 'income' ? '+' : '-'} ${formatINR(t.amount)}
        </div>
        <div class="text-xs text-gray-500">${t.type}</div>
      </div>
    </div>
  `).join('');
}

// ---------- Budget Page ----------
let currentBudgetMonth = getMonthKey(new Date());

function renderBudgetPage(monthKey) {
  currentBudgetMonth = monthKey;
  const totals = getTotalsForMonth(monthKey);

  document.getElementById('budgetMonthLabel').textContent = formatMonthLabel(monthKey);
  document.getElementById('remainingBalance').textContent = formatINR(totals.remaining);

  renderEntriesList(monthKey);

  // ⭐ NEW: Refresh summary table dynamically
  renderBudgetSummary(monthKey);
}


function renderBudgetSummary(monthKey) {
  const totals = getTotalsForMonth(monthKey);

  const incomeEl = document.getElementById("summaryIncome");
  const expenseEl = document.getElementById("summaryExpense");
  const remainingEl = document.getElementById("summaryRemaining");

  if (!incomeEl || !expenseEl || !remainingEl) return;

  incomeEl.textContent = formatINR(totals.income);
  expenseEl.textContent = formatINR(totals.expense);
  remainingEl.textContent = formatINR(totals.remaining);
}


function renderEntriesList(monthKey) {
  const list = document.getElementById('entriesList');
  const entries = store.entries[monthKey] || [];
  
  if (entries.length === 0) {
    list.innerHTML = '<div class="p-6 text-center text-gray-500">No entries for this month. Click "Add Entry" to start.</div>';
    return;
  }
  
  list.innerHTML = entries.map(e => `
    <div class="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
      <div class="flex-1">
        <div class="font-medium text-gray-900">${e.description || e.category}</div>
        <div class="text-sm text-gray-500">${new Date(e.date).toLocaleDateString('en-IN')} • ${e.category}</div>
        ${e.note ? `<div class="text-xs text-gray-400 mt-1">${e.note}</div>` : ''}
      </div>
      <div class="flex items-center gap-3">
        <div class="text-right">
          <div class="font-semibold ${e.type === 'income' ? 'text-green-600' : 'text-red-600'}">
            ${e.type === 'income' ? '+' : '-'} ${formatINR(e.amount)}
          </div>
          <div class="text-xs text-gray-500">${e.type}</div>
        </div>
        <div class="flex gap-1">
          <button onclick="editEntry('${e.id}')" class="p-2 text-blue-600 hover:bg-blue-50 rounded">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
          <button onclick="confirmDeleteEntry('${e.id}')" class="p-2 text-red-600 hover:bg-red-50 rounded">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

function showAddEntryModal() {
  const expenseCategories = store.settings.expenseCategories;
  const incomeCategories = ['Salary', 'Others'];
  
  const modal = `
    <div class="modal bg-white rounded-xl p-6 max-w-2xl w-full mx-4 shadow-2xl">
      <h3 class="text-2xl font-bold mb-6">Add Entry</h3>
      <form id="entryForm" class="space-y-4">
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 mb-2">Type</label>
          <select name="type" id="entryType" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </div>
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 mb-2">Category</label>
          <select name="category" id="categorySelect" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
            ${expenseCategories.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
          <div id="customCategoryContainer" class="hidden mt-2">
            <input type="text" id="customCategory" name="customCategory" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="Enter custom category">
          </div>
        </div>
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <input type="text" name="description" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="e.g., Monthly rent payment">
        </div>
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 mb-2">Amount (₹)</label>
          <input type="number" name="amount" step="0.01" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="0.00">
        </div>
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 mb-2">Date</label>
          <input type="date" name="date" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 mb-2">Note (optional)</label>
          <textarea name="note" rows="3" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="Additional notes..."></textarea>
        </div>
        <div class="flex gap-3 pt-4">
          <button type="submit" class="flex-1 bg-accent-500 hover:bg-accent-600 text-white px-6 py-3 rounded-lg font-medium transition-colors">Add Entry</button>
          <button type="button" onclick="hideModal()" class="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors">Cancel</button>
        </div>
      </form>
    </div>
  `;
  
  showModal(modal);
  
  const typeSelect = document.getElementById('entryType');
  const categorySelect = document.getElementById('categorySelect');
  const customCategoryContainer = document.getElementById('customCategoryContainer');
  const customCategoryInput = document.getElementById('customCategory');
  
  typeSelect.addEventListener('change', function() {
    updateCategoryOptions(this.value);
  });
  
  categorySelect.addEventListener('change', function() {
    if (typeSelect.value === 'income' && this.value === 'Others') {
      customCategoryContainer.classList.remove('hidden');
      customCategoryInput.required = true;
    } else {
      customCategoryContainer.classList.add('hidden');
      customCategoryInput.required = false;
    }
  });
  
  function updateCategoryOptions(type) {
    const currentValue = categorySelect.value;
    
    if (type === 'income') {
      categorySelect.innerHTML = incomeCategories.map(c => `<option value="${c}">${c}</option>`).join('');
      
      if (currentValue === 'Others') {
        customCategoryContainer.classList.remove('hidden');
        customCategoryInput.required = true;
      }
    } else {
      categorySelect.innerHTML = expenseCategories.map(c => `<option value="${c}">${c}</option>`).join('');
      customCategoryContainer.classList.add('hidden');
      customCategoryInput.required = false;
    }
  }
  
  document.getElementById('entryForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    let category = formData.get('category');
    
    if (typeSelect.value === 'income' && category === 'Others' && customCategoryInput.value.trim()) {
      category = customCategoryInput.value.trim();
      addCustomCategory(category);
    }
    
    const entry = {
      type: formData.get('type'),
      category: category,
      description: formData.get('description'),
      amount: parseFloat(formData.get('amount')),
      date: formData.get('date'),
      note: formData.get('note')
    };
    addEntry(entry);
    hideModal();
    renderBudgetPage(currentBudgetMonth);
  });
}

function editEntry(id) {
  let entry;
  for (const arr of Object.values(store.entries)) {
    entry = arr.find(e => e.id === id);
    if (entry) break;
  }
  if (!entry) return;
  
  const expenseCategories = store.settings.expenseCategories;
  const incomeCategories = ['Salary', 'Others'];
  
  const isCustomIncome = entry.type === 'income' && !incomeCategories.includes(entry.category);
  const selectedCategory = isCustomIncome ? 'Others' : entry.category;
  
  const modal = `
    <div class="modal bg-white rounded-xl p-6 max-w-2xl w-full mx-4 shadow-2xl">
      <h3 class="text-2xl font-bold mb-6">Edit Entry</h3>
      <form id="editEntryForm" class="space-y-4">
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 mb-2">Type</label>
          <select name="type" id="editEntryType" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
            <option value="expense" ${entry.type === 'expense' ? 'selected' : ''}>Expense</option>
            <option value="income" ${entry.type === 'income' ? 'selected' : ''}>Income</option>
          </select>
        </div>
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 mb-2">Category</label>
          <select name="category" id="editCategorySelect" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
            ${entry.type === 'income' 
              ? incomeCategories.map(c => `<option value="${c}" ${selectedCategory === c ? 'selected' : ''}>${c}</option>`).join('')
              : expenseCategories.map(c => `<option value="${c}" ${entry.category === c ? 'selected' : ''}>${c}</option>`).join('')
            }
          </select>
          <div id="editCustomCategoryContainer" class="${isCustomIncome ? '' : 'hidden'} mt-2">
            <input type="text" id="editCustomCategory" name="customCategory" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="Enter custom category" value="${isCustomIncome ? entry.category : ''}">
          </div>
        </div>
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <input type="text" name="description" value="${entry.description || ''}" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
        </div>
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 mb-2">Amount (₹)</label>
          <input type="number" name="amount" step="0.01" value="${entry.amount}" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
        </div>
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 mb-2">Date</label>
          <input type="date" name="date" value="${entry.date}" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
        </div>
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 mb-2">Note (optional)</label>
          <textarea name="note" rows="3" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">${entry.note || ''}</textarea>
        </div>
        <div class="flex gap-3 pt-4">
          <button type="submit" class="flex-1 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors">Update Entry</button>
          <button type="button" onclick="hideModal()" class="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors">Cancel</button>
        </div>
      </form>
    </div>
  `;
  
  showModal(modal);
  
  const typeSelect = document.getElementById('editEntryType');
  const categorySelect = document.getElementById('editCategorySelect');
  const customCategoryContainer = document.getElementById('editCustomCategoryContainer');
  const customCategoryInput = document.getElementById('editCustomCategory');
  
  typeSelect.addEventListener('change', function() {
    updateCategoryOptions(this.value);
  });
  
  categorySelect.addEventListener('change', function() {
    if (typeSelect.value === 'income' && this.value === 'Others') {
      customCategoryContainer.classList.remove('hidden');
      customCategoryInput.required = true;
    } else {
      customCategoryContainer.classList.add('hidden');
      customCategoryInput.required = false;
    }
  });
  
  function updateCategoryOptions(type) {
    if (type === 'income') {
      categorySelect.innerHTML = incomeCategories.map(c => `<option value="${c}">${c}</option>`).join('');
      
      if (categorySelect.value === 'Others') {
        customCategoryContainer.classList.remove('hidden');
        customCategoryInput.required = true;
      }
    } else {
      categorySelect.innerHTML = expenseCategories.map(c => `<option value="${c}">${c}</option>`).join('');
      customCategoryContainer.classList.add('hidden');
      customCategoryInput.required = false;
    }
  }
  
  document.getElementById('editEntryForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    let category = formData.get('category');
    
    if (typeSelect.value === 'income' && category === 'Others' && customCategoryInput.value.trim()) {
      category = customCategoryInput.value.trim();
      addCustomCategory(category);
    }
    
    const updates = {
      type: formData.get('type'),
      category: category,
      description: formData.get('description'),
      amount: parseFloat(formData.get('amount')),
      date: formData.get('date'),
      note: formData.get('note')
    };
    updateEntry(id, updates);
    hideModal();
    renderBudgetPage(currentBudgetMonth);
  });
}

function confirmDeleteEntry(id) {
  if (confirm('Are you sure you want to delete this entry?')) {
    deleteEntry(id);
    renderBudgetPage(currentBudgetMonth);
  }
}

function renderBudgetSummary(monthKey) {
  const totals = getTotalsForMonth(monthKey);

  const incomeEl = document.getElementById('summaryIncome');
  const expenseEl = document.getElementById('summaryExpense');
  const remainingEl = document.getElementById('summaryRemaining');

  if (!incomeEl || !expenseEl || !remainingEl) return;

  incomeEl.textContent = formatINR(totals.income);
  expenseEl.textContent = formatINR(totals.expense);
  remainingEl.textContent = formatINR(totals.remaining);
}


// ---------- Savings Page ----------
function renderSavingsPage() {
  const list = document.getElementById('savingsList');
  const savingsEntries = Object.values(store.entries)
    .flat()
    .filter(e => e.type === 'expense' && e.category === 'Savings')
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  
  if (savingsEntries.length === 0) {
    list.innerHTML = '<div class="p-6 text-center text-gray-500">No savings entries yet. Click "Add Savings" to start.</div>';
    return;
  }
  
  const totalSavings = savingsEntries.reduce((sum, e) => sum + Number(e.amount), 0);
  
  list.innerHTML = `
    <div class="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-b">
      <div class="text-sm text-gray-600 font-medium">Total Savings</div>
      <div class="text-3xl font-bold text-green-700 mt-1">${formatINR(totalSavings)}</div>
    </div>
    ${savingsEntries.map(e => `
      <div class="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
        <div class="flex-1">
          <div class="font-medium text-gray-900">${e.description}</div>
          <div class="text-sm text-gray-500">${new Date(e.date).toLocaleDateString('en-IN')}</div>
        </div>
        <div class="text-right font-semibold text-green-600">
          ${formatINR(e.amount)}
        </div>
      </div>
    `).join('')}
  `;
}

function showAddSavingsModal() {
  const modal = `
    <div class="modal bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
      <h3 class="text-2xl font-bold mb-6">Add Savings</h3>
      <form id="savingsForm" class="space-y-4">
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <input type="text" name="description" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="e.g., Monthly savings">
        </div>
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 mb-2">Amount (₹)</label>
          <input type="number" name="amount" step="0.01" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="0.00">
        </div>
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 mb-2">Date</label>
          <input type="date" name="date" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="flex gap-3 pt-4">
          <button type="submit" class="flex-1 bg-accent-500 hover:bg-accent-600 text-white px-6 py-3 rounded-lg font-medium transition-colors">Add Savings</button>
          <button type="button" onclick="hideModal()" class="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors">Cancel</button>
        </div>
      </form>
    </div>
  `;
  
  showModal(modal);
  
  document.getElementById('savingsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    addSavings(
      formData.get('amount'),
      formData.get('description'),
      formData.get('date')
    );
    hideModal();
    renderSavingsPage();
  });
}

// ---------- Loans Page ----------
function renderLoansPage() {
  const list = document.getElementById('loansList');
  const loans = store.loans;
  
  if (loans.length === 0) {
    list.innerHTML = '<div class="p-6 text-center text-gray-500">No loans tracked. Click "Add Loan" to start.</div>';
    return;
  }
  
  list.innerHTML = loans.map(loan => {
    const remaining = loan.principal - (loan.paidAmount || 0);
    const progress = ((loan.paidAmount || 0) / loan.principal) * 100;
    
    return `
      <div class="p-4 hover:bg-gray-50 transition-colors">
        <div class="flex items-start justify-between mb-3">
          <div class="flex-1">
            <div class="font-semibold text-gray-900 text-lg">${loan.name}</div>
            <div class="text-sm text-gray-500 mt-1">${loan.lender || 'Lender not specified'}</div>
          </div>
          <div class="flex gap-1">
            <button onclick="editLoan('${loan.id}')" class="p-2 text-blue-600 hover:bg-blue-50 rounded">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
            </button>
            <button onclick="confirmDeleteLoan('${loan.id}')" class="p-2 text-red-600 hover:bg-red-50 rounded">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4 mb-3">
          <div>
            <div class="text-xs text-gray-500">Principal</div>
            <div class="font-semibold text-gray-900">${formatINR(loan.principal)}</div>
          </div>
          <div>
            <div class="text-xs text-gray-500">Interest Rate</div>
            <div class="font-semibold text-gray-900">${loan.interestRate}%</div>
          </div>
          <div>
            <div class="text-xs text-gray-500">Paid</div>
            <div class="font-semibold text-green-600">${formatINR(loan.paidAmount || 0)}</div>
          </div>
          <div>
            <div class="text-xs text-gray-500">Remaining</div>
            <div class="font-semibold text-red-600">${formatINR(remaining)}</div>
          </div>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2.5">
          <div class="bg-accent-500 h-2.5 rounded-full transition-all" style="width: ${progress}%"></div>
        </div>
        <div class="text-xs text-gray-500 mt-1">${progress.toFixed(1)}% paid</div>
      </div>
    `;
  }).join('');
}

function showAddLoanModal() {
  const modal = `
    <div class="modal bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
      <h3 class="text-2xl font-bold mb-6">Add Loan</h3>
      <form id="loanForm" class="space-y-4">
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 mb-2">Loan Name</label>
          <input type="text" name="name" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="e.g., Home Loan">
        </div>
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 mb-2">Lender</label>
          <input type="text" name="lender" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="e.g., Bank name">
        </div>
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 mb-2">Principal Amount (₹)</label>
          <input type="number" name="principal" step="0.01" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="0.00">
        </div>
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 mb-2">Interest Rate (%)</label>
          <input type="number" name="interestRate" step="0.01" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="0.00">
        </div>
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 mb-2">Already Paid (₹)</label>
          <input type="number" name="paidAmount" step="0.01" value="0" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="0.00">
        </div>
        <div class="flex gap-3 pt-4">
          <button type="submit" class="flex-1 bg-accent-500 hover:bg-accent-600 text-white px-6 py-3 rounded-lg font-medium transition-colors">Add Loan</button>
          <button type="button" onclick="hideModal()" class="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors">Cancel</button>
        </div>
      </form>
    </div>
  `;
  
  showModal(modal);
  
  document.getElementById('loanForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const loan = {
      name: formData.get('name'),
      lender: formData.get('lender'),
      principal: parseFloat(formData.get('principal')),
      interestRate: parseFloat(formData.get('interestRate')),
      paidAmount: parseFloat(formData.get('paidAmount'))
    };
    addLoan(loan);
    hideModal();
    renderLoansPage();
  });
}

function editLoan(id) {
  const loan = store.loans.find(l => l.id === id);
  if (!loan) return;
  
  const modal = `
    <div class="modal bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
      <h3 class="text-2xl font-bold mb-6">Edit Loan</h3>
      <form id="editLoanForm" class="space-y-4">
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 mb-2">Loan Name</label>
          <input type="text" name="name" value="${loan.name}" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
        </div>
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 mb-2">Lender</label>
          <input type="text" name="lender" value="${loan.lender || ''}" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
        </div>
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 mb-2">Principal Amount (₹)</label>
          <input type="number" name="principal" step="0.01" value="${loan.principal}" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
        </div>
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 mb-2">Interest Rate (%)</label>
          <input type="number" name="interestRate" step="0.01" value="${loan.interestRate}" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
        </div>
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 mb-2">Already Paid (₹)</label>
          <input type="number" name="paidAmount" step="0.01" value="${loan.paidAmount || 0}" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
        </div>
        <div class="flex gap-3 pt-4">
          <button type="submit" class="flex-1 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors">Update Loan</button>
          <button type="button" onclick="hideModal()" class="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors">Cancel</button>
        </div>
      </form>
    </div>
  `;
  
  showModal(modal);
  
  document.getElementById('editLoanForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const updates = {
      name: formData.get('name'),
      lender: formData.get('lender'),
      principal: parseFloat(formData.get('principal')),
      interestRate: parseFloat(formData.get('interestRate')),
      paidAmount: parseFloat(formData.get('paidAmount'))
    };
    updateLoan(id, updates);
    hideModal();
    renderLoansPage();
  });
}

function confirmDeleteLoan(id) {
  if (confirm('Are you sure you want to delete this loan?')) {
    deleteLoan(id);
    renderLoansPage();
  }
}

// ---------- Goals Page ----------
function renderGoalsPage() {
  const list = document.getElementById('goalsList');
  const goals = store.goals;
  
  if (goals.length === 0) {
    list.innerHTML = '<div class="p-6 text-center text-gray-500">No goals set yet. Click "Add Goal" to start.</div>';
    return;
  }
  
  list.innerHTML = goals.map(goal => {
    const progress = getGoalProgress(goal);
    const targetDate = new Date(goal.targetDate);
    const isOverdue = targetDate < new Date();
    
    return `
      <div class="p-4 hover:bg-gray-50 transition-colors">
        <div class="flex items-start justify-between mb-3">
          <div class="flex-1">
            <div class="font-semibold text-gray-900 text-lg">${goal.title}</div>
            <div class="text-sm text-gray-500 mt-1">${goal.description || 'No description'}</div>
          </div>
          <div class="flex gap-1">
            <button onclick="editGoal('${goal.id}')" class="p-2 text-blue-600 hover:bg-blue-50 rounded">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
            </button>
            <button onclick="confirmDeleteGoal('${goal.id}')" class="p-2 text-red-600 hover:bg-red-50 rounded">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4 mb-3">
          <div>
            <div class="text-xs text-gray-500">Target Amount</div>
            <div class="font-semibold text-gray-900">${formatINR(goal.targetAmount)}</div>
          </div>
          <div>
            <div class="text-xs text-gray-500">Target Date</div>
            <div class="font-semibold ${isOverdue ? 'text-red-600' : 'text-gray-900'}">${targetDate.toLocaleDateString('en-IN')}</div>
          </div>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2.5">
          <div class="bg-accent-500 h-2.5 rounded-full transition-all" style="width: ${progress}%"></div>
        </div>
        <div class="text-xs text-gray-500 mt-1">${progress.toFixed(1)}% completed</div>
      </div>
    `;
  }).join('');
}

function showAddGoalModal() {
  const modal = `
    <div class="modal bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
      <h3 class="text-2xl font-bold mb-6">Add Goal</h3>
      <form id="goalForm" class="space-y-4">
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 mb-2">Goal Title</label>
          <input type="text" name="title" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="e.g., Emergency Fund">
        </div>
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <textarea name="description" rows="2" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="Optional description"></textarea>
        </div>
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 mb-2">Target Amount (₹)</label>
          <input type="number" name="targetAmount" step="0.01" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="0.00">
        </div>
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 mb-2">Target Date</label>
          <input type="date" name="targetDate" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
        </div>
        <div class="flex gap-3 pt-4">
          <button type="submit" class="flex-1 bg-accent-500 hover:bg-accent-600 text-white px-6 py-3 rounded-lg font-medium transition-colors">Add Goal</button>
          <button type="button" onclick="hideModal()" class="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors">Cancel</button>
        </div>
      </form>
    </div>
  `;
  
  showModal(modal);
  
  document.getElementById('goalForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const goal = {
      title: formData.get('title'),
      description: formData.get('description'),
      targetAmount: parseFloat(formData.get('targetAmount')),
      targetDate: formData.get('targetDate')
    };
    addGoal(goal);
    hideModal();
    renderGoalsPage();
  });
}

function editGoal(id) {
  const goal = store.goals.find(g => g.id === id);
  if (!goal) return;
  
  const modal = `
    <div class="modal bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
      <h3 class="text-2xl font-bold mb-6">Edit Goal</h3>
      <form id="editGoalForm" class="space-y-4">
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 mb-2">Goal Title</label>
          <input type="text" name="title" value="${goal.title}" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
        </div>
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <textarea name="description" rows="2" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">${goal.description || ''}</textarea>
        </div>
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 mb-2">Target Amount (₹)</label>
          <input type="number" name="targetAmount" step="0.01" value="${goal.targetAmount}" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
        </div>
        <div class="field">
          <label class="block text-sm font-medium text-gray-700 mb-2">Target Date</label>
          <input type="date" name="targetDate" value="${goal.targetDate}" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
        </div>
        <div class="flex gap-3 pt-4">
          <button type="submit" class="flex-1 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors">Update Goal</button>
          <button type="button" onclick="hideModal()" class="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors">Cancel</button>
        </div>
      </form>
    </div>
  `;
  
  showModal(modal);
  
  document.getElementById('editGoalForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const updates = {
      title: formData.get('title'),
      description: formData.get('description'),
      targetAmount: parseFloat(formData.get('targetAmount')),
      targetDate: formData.get('targetDate')
    };
    updateGoal(id, updates);
    hideModal();
    renderGoalsPage();
  });
}

function confirmDeleteGoal(id) {
  if (confirm('Are you sure you want to delete this goal?')) {
    deleteGoal(id);
    renderGoalsPage();
  }
}

// ---------- Sidebar Toggle Function ----------
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.getElementById('main');
  
  if (sidebar.classList.contains('hidden')) {
    // Show sidebar
    sidebar.classList.remove('hidden');
    sidebar.classList.add('fixed', 'inset-0', 'z-50', 'md:relative', 'md:inset-auto');
  } else {
    // Hide sidebar
    sidebar.classList.add('hidden');
    sidebar.classList.remove('fixed', 'inset-0', 'z-50', 'md:relative', 'md:inset-auto');
  }
}

// Update the navigation to close sidebar on mobile when clicking nav items
document.addEventListener('DOMContentLoaded', () => {
  // ... your existing event listeners ...
  document.addEventListener("DOMContentLoaded", () => {
    updateHomeOverviewCard();
});
  // Close sidebar when clicking nav items on mobile
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (window.innerWidth < 768) {
        toggleSidebar();
      }
    });
  });
});

// ---------- Event Listeners ----------
document.addEventListener('DOMContentLoaded', () => {
  // Navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const page = e.currentTarget.dataset.page;
      showPage(page);
    });
  });
  
  // Chart navigation
  document.getElementById('chartPrev')?.addEventListener('click', () => {
    const [y, m] = currentChartStart.split('-').map(Number);
    const newDate = new Date(y, m - 7);
    currentChartStart = getMonthKey(newDate);
    if (homeActiveCategory === 'budget') {
      renderHomeCategoryContent();
    }
  });
  
  document.getElementById('chartNext')?.addEventListener('click', () => {
    const [y, m] = currentChartStart.split('-').map(Number);
    const newDate = new Date(y, m + 5);
    currentChartStart = getMonthKey(newDate);
    if (homeActiveCategory === 'budget') {
      renderHomeCategoryContent();
    }
  });
  
  // Budget month navigation
  document.getElementById('budgetPrev')?.addEventListener('click', () => {
    const [y, m] = currentBudgetMonth.split('-').map(Number);
    const newDate = new Date(y, m - 2);
    currentBudgetMonth = getMonthKey(newDate);
    renderBudgetPage(currentBudgetMonth);
  });
  
  document.getElementById('budgetNext')?.addEventListener('click', () => {
    const [y, m] = currentBudgetMonth.split('-').map(Number);
    const newDate = new Date(y, m);
    currentBudgetMonth = getMonthKey(newDate);
    renderBudgetPage(currentBudgetMonth);
  });
  
  // Add buttons
  document.getElementById('addEntryBtn')?.addEventListener('click', showAddEntryModal);
  document.getElementById('addSavingsBtn')?.addEventListener('click', showAddSavingsModal);
  document.getElementById('addLoanBtn')?.addEventListener('click', showAddLoanModal);
  document.getElementById('addGoalBtn')?.addEventListener('click', showAddGoalModal);
  
  // Export buttons
  document.getElementById('exportBtn')?.addEventListener('click', exportData);
  document.getElementById('exportBtn2')?.addEventListener('click', exportData);
  document.getElementById('mobileExport')?.addEventListener('click', exportData);
  
  // Import buttons
  document.getElementById('importInput')?.addEventListener('change', (e) => {
    if (e.target.files[0]) {
      const merge = confirm('Merge with existing data? (Cancel to replace all data)');
      importData(e.target.files[0], merge);
    }
  });
  
  document.getElementById('importInput2')?.addEventListener('change', (e) => {
    if (e.target.files[0]) {
      const merge = confirm('Merge with existing data? (Cancel to replace all data)');
      importData(e.target.files[0], merge);
    }
  });
  
  // Modal backdrop click
  document.getElementById('modalRoot')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalRoot') {
      hideModal();
    }
  });
  
  // Mobile menu / Sidebar toggle
  document.getElementById('mobileMenuBtn')?.addEventListener('click', toggleSidebar);
  
  // Initialize home page
  showPage('home');
});

function loadEntriesForMonth(monthKey) {
    const data = JSON.parse(localStorage.getItem("hb_budget_v1")) || {};
    return data.entries?.[monthKey] || [];
}



function updateHomeOverviewCard() {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const entries = loadEntriesForMonth(monthKey); // Your existing storage loader

    let income = 0;
    let expenses = 0;

    entries.forEach(e => {
        if (e.type === "income") income += e.amount;
        else if (e.type === "expense") expenses += e.amount;
    });

    const remaining = income - expenses;

    // Update UI
    document.getElementById("overviewIncome").textContent = `₹${income.toLocaleString("en-IN")}`;
    document.getElementById("overviewExpense").textContent = `₹${expenses.toLocaleString("en-IN")}`;
    document.getElementById("overviewRemaining").textContent = `₹${remaining.toLocaleString("en-IN")}`;
}


// ===========================================================
// End of app.js
// ===========================================================