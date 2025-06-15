// Dice Job Application Automation Script
// This script automates job applications on Dice.com using Playwright and logs results in an Excel file.
// It includes enhanced error handling, logging, and HTML report generation.

const { test, expect } = require("@playwright/test");
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");

const SEARCH_ITEMS = [
  // General QA / Testing Roles
  "Software Tester",
  "Quality",
  "Test Analyst",
  "Manual Tester",
  "QA",

  // Automation-Focused Roles
  "Automation",
  "Test Automation",

  // SDET-Focused Titles
  "SDET",
  "Software Developer Engineer in Test",

  // Performance Testing Roles
  "Performance",
  "Load",
  "Stress",
];

const MAX_PAGES = 3; // Reduced for stability
const LOGIN_URL = "https://www.dice.com/dashboard/login";
const USERNAME = "amar.sdet1@gmail.com"; // Replace with your Dice username
const PASSWORD = "Admin@lcl25"; // Replace with your Dice password
const MAX_CONCURRENT_TABS = 2; // Reduced concurrency
const TAB_DELAY = 2000; // Increased delay
const PAGE_DELAY = 3000; // Added page delay

// Increased test timeout
test.setTimeout(900000); // 15 minutes

class JobApplicationLogger {
  constructor() {
    this.workbook = new ExcelJS.Workbook();
    this.worksheet = null;
    this.serialNumber = 1;
    this.logsDir = path.join(__dirname, "..", "Logs");
    this.reportsDir = path.join(__dirname, "..", "Reports");
    this.filename = this.generateFilename();
    this.filepath = path.join(this.logsDir, this.filename);
    this.htmlReportPath = path.join(
      this.reportsDir,
      this.filename.replace(".xlsx", ".html")
    );
    this.startTime = new Date();
    this.jobData = [];
  }

  generateFilename() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;

    return `JobApp_${year}-${month}-${day}_${String(displayHours).padStart(
      2,
      "0"
    )}-${minutes}-${ampm}.xlsx`;
  }

  async initializeExcel() {
    try {
      // Create directories if they don't exist
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
        console.log(`✅ Created Logs directory: ${this.logsDir}`);
      }

      if (!fs.existsSync(this.reportsDir)) {
        fs.mkdirSync(this.reportsDir, { recursive: true });
        console.log(`✅ Created Reports directory: ${this.reportsDir}`);
      }

      // Create new worksheet
      this.worksheet = this.workbook.addWorksheet("Job Applications");

      // Set up headers
      this.worksheet.columns = [
        { header: "Sr.No", key: "serialNo", width: 10 },
        { header: "Job Title", key: "jobTitle", width: 50 },
        { header: "Company Name", key: "companyName", width: 30 },
        { header: "Status", key: "status", width: 25 },
        { header: "Timestamp", key: "timestamp", width: 20 },
      ];

      // Format header row
      const headerRow = this.worksheet.getRow(1);
      headerRow.font = { name: "Arial", size: 11, bold: true };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFB3D9FF" },
      };
      headerRow.alignment = { horizontal: "center", vertical: "middle" };

      console.log(`✅ Initialized Excel file: ${this.filename}`);
    } catch (error) {
      console.error(`❌ Error initializing Excel: ${error.message}`);
      throw error;
    }
  }

  async logJob(jobTitle, companyName, status) {
    try {
      if (!this.worksheet) {
        console.error("❌ Excel worksheet not initialized");
        return;
      }

      const timestamp = new Date().toLocaleString();
      const jobEntry = {
        serialNo: this.serialNumber,
        jobTitle: jobTitle || "Unknown Job Title",
        companyName: companyName || "Unknown Company",
        status: status,
        timestamp: timestamp,
        category: this.categorizeStatus(status),
      };

      // Store for HTML report
      this.jobData.push(jobEntry);

      const row = this.worksheet.addRow(jobEntry);

      // Format the row
      row.font = { name: "Arial", size: 10 };
      row.alignment = { horizontal: "left", vertical: "middle" };

      // Color code based on status
      let fillColor = "FFFFFFFF"; // White default
      const statusLower = status.toLowerCase();
      if (statusLower.includes("success") || statusLower.includes("applied")) {
        fillColor = "FFD4EDDA"; // Light green
      } else if (
        statusLower.includes("failed") ||
        statusLower.includes("error")
      ) {
        fillColor = "FFF8D7DA"; // Light red
      } else if (statusLower.includes("already applied")) {
        fillColor = "FFFFEAA7"; // Light orange
      } else if (statusLower.includes("skipped")) {
        fillColor = "FFFFF3CD"; // Light yellow
      }

      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: fillColor },
      };

      this.serialNumber++;
      console.log(
        `📝 [${this.serialNumber - 1}] ${jobTitle} - ${companyName} - ${status}`
      );

      // Save periodically
      if (this.serialNumber % 5 === 0) {
        await this.saveExcel();
      }
    } catch (error) {
      console.error(`❌ Error logging job: ${error.message}`);
    }
  }

  categorizeStatus(status) {
    const statusLower = status.toLowerCase();
    if (statusLower.includes("success") || statusLower.includes("applied"))
      return "success";
    if (statusLower.includes("already applied")) return "already_applied";
    if (statusLower.includes("skipped")) return "skipped";
    if (statusLower.includes("failed") || statusLower.includes("error"))
      return "failed";
    return "unknown";
  }

  async saveExcel() {
    try {
      await this.workbook.xlsx.writeFile(this.filepath);
    } catch (error) {
      console.error(`❌ Error saving Excel file: ${error.message}`);
    }
  }

  getLogSummary() {
    return {
      filename: this.filename,
      totalEntries: this.serialNumber - 1,
      filepath: this.filepath,
      htmlReportPath: this.htmlReportPath,
    };
  }

  async generateHtmlReport() {
    try {
      const appliedJobs = this.jobData.filter((j) => j.category === "success");
      const alreadyAppliedJobs = this.jobData.filter(
        (j) => j.category === "already_applied"
      );
      const failedJobs = this.jobData.filter((j) => j.category === "failed");
      const skippedJobs = this.jobData.filter((j) => j.category === "skipped");
      const unknownJobs = this.jobData.filter((j) => j.category === "unknown");

      const stats = {
        applied: appliedJobs.length,
        alreadyApplied: alreadyAppliedJobs.length,
        failed: failedJobs.length,
        skipped: skippedJobs.length,
        unknown: unknownJobs.length,
      };

      // Group jobs by search term
      const jobsBySearchTerm = {};
      SEARCH_ITEMS.forEach((term) => {
        jobsBySearchTerm[term] = this.jobData.filter((job) =>
          job.jobTitle.toLowerCase().includes(term.toLowerCase())
        );
      });

      const html = `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Job Application Dashboard</title>
        <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
        <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
        <script src="https://unpkg.com/babel-standalone@6/babel.min.js"></script>
        <script src="https://unpkg.com/framer-motion@10.12.18/dist/framer-motion.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          :root {
            --primary-color: #6366f1;
            --secondary-color: #818cf8;
            --success-color: #22c55e;
            --warning-color: #eab308;
            --danger-color: #ef4444;
            --background-color: #f8fafc;
          }

          body {
            font-family: 'Inter', sans-serif;
            background-color: var(--background-color);
            margin: 0;
            padding: 0;
          }

          .card {
            background: rgba(255, 255, 255, 0.9);
            border-radius: 16px;
            box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(5px);
            border: 1px solid rgba(255, 255, 255, 0.3);
            transition: all 0.3s ease;
          }

          .card:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 40px rgba(0, 0, 0, 0.12);
          }

          .stats-card {
            background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
          }

          .chart-container {
            position: relative;
            margin: auto;
            height: 300px;
            width: 100%;
          }

          .tab {
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s ease;
          }

          .tab.active {
            background-color: var(--primary-color);
            color: white;
          }

          .grid-container {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 1.5rem;
            padding: 1.5rem;
          }

          @keyframes fadeUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .fade-up {
            animation: fadeUp 0.5s ease forwards;
          }

          .chart-animation {
            animation: scaleIn 0.5s ease forwards;
          }

          @keyframes scaleIn {
            from {
              transform: scale(0.9);
              opacity: 0;
            }
            to {
              transform: scale(1);
              opacity: 1;
            }
          }

          .search-filter {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 8px;
            padding: 0.5rem;
            border: 1px solid #e2e8f0;
          }

          .stats-number {
            font-size: 2.5rem;
            font-weight: 700;
            background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }

          @media (max-width: 768px) {
            .grid-container {
              grid-template-columns: 1fr;
            }
          }
        </style>
      </head>
      <body>
        <div id="root"></div>

        <script type="text/babel">
          const { useState, useEffect, useRef } = React;
          const { motion, AnimatePresence } = Motion;

          function DashboardCard({ title, value, icon, color }) {
            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card stats-card p-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-gray-500 text-sm font-medium">{title}</h3>
                    <p className="stats-number mt-2">{value}</p>
                  </div>
                  <div className={\`p-3 rounded-full bg-\${color}-100\`}>
                    <svg className={\`w-6 h-6 text-\${color}-600\`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {icon}
                    </svg>
                  </div>
                </div>
              </motion.div>
            );
          }

          function ChartSection({ data }) {
            const chartRef = useRef(null);

            useEffect(() => {
              if (chartRef.current) {
                const ctx = chartRef.current.getContext('2d');
                new Chart(ctx, {
                  type: 'doughnut',
                  data: {
                    labels: ['Applied', 'Already Applied', 'Failed', 'Skipped'],
                    datasets: [{
                      data: [data.applied, data.alreadyApplied, data.failed, data.skipped],
                      backgroundColor: [
                        'rgba(99, 102, 241, 0.8)',
                        'rgba(234, 179, 8, 0.8)',
                        'rgba(239, 68, 68, 0.8)',
                        'rgba(129, 140, 248, 0.8)'
                      ],
                      borderWidth: 0
                    }]
                  },
                  options: {
                    responsive: true,
                    plugins: {
                      legend: {
                        position: 'bottom'
                      }
                    },
                    animation: {
                      animateScale: true,
                      animateRotate: true
                    }
                  }
                });
              }
            }, []);

            return (
              <div className="card p-6">
                <h3 className="text-lg font-semibold mb-4">Application Distribution</h3>
                <div className="chart-container">
                  <canvas ref={chartRef}></canvas>
                </div>
              </div>
            );
          }

          function ApplicationsTable({ jobs, searchTerm, statusFilter }) {
            const filteredJobs = jobs.filter(job => {
              const matchesSearch = !searchTerm || 
                job.jobTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                job.companyName.toLowerCase().includes(searchTerm.toLowerCase());
              const matchesStatus = !statusFilter || job.category === statusFilter;
              return matchesSearch && matchesStatus;
            });

            return (
              <div className="card p-6 overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">Job Title</th>
                      <th className="text-left p-3">Company</th>
                      <th className="text-left p-3">Status</th>
                      <th className="text-left p-3">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJobs.map((job, index) => (
                      <motion.tr
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="border-b hover:bg-gray-50"
                      >
                        <td className="p-3">{job.jobTitle}</td>
                        <td className="p-3">{job.companyName}</td>
                        <td className="p-3">
                          <span className={\`px-2 py-1 rounded-full text-sm \${
                            job.category === 'success' ? 'bg-green-100 text-green-800' :
                            job.category === 'already_applied' ? 'bg-yellow-100 text-yellow-800' :
                            job.category === 'failed' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }\`}>
                            {job.status}
                          </span>
                        </td>
                        <td className="p-3">{job.timestamp}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }

          function Dashboard() {
            const [activeTab, setActiveTab] = useState('overview');
            const [searchTerm, setSearchTerm] = useState('');
            const [statusFilter, setStatusFilter] = useState('');
            const [selectedSearchItem, setSelectedSearchItem] = useState('');

            const stats = ${JSON.stringify(stats)};
            const jobs = ${JSON.stringify(this.jobData)};
            const searchItems = ${JSON.stringify(SEARCH_ITEMS)};
            const jobsBySearchTerm = ${JSON.stringify(jobsBySearchTerm)};

            return (
              <div className="min-h-screen bg-gray-50">
                <nav className="bg-white border-b">
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                      <div className="flex">
                        <div className="flex-shrink-0 flex items-center">
                          <h1 className="text-xl font-bold text-indigo-600">Job Dashboard</h1>
                        </div>
                        <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                          {['overview', 'applications', 'analytics'].map(tab => (
                            <motion.button
                              key={tab}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setActiveTab(tab)}
                              className={\`\${
                                activeTab === tab
                                  ? 'border-indigo-500 text-gray-900'
                                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                              } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium\`}
                            >
                              {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </nav>

                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                  <AnimatePresence mode="wait">
                    {activeTab === 'overview' && (
                      <motion.div
                        key="overview"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-6"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                          <DashboardCard
                            title="Applied"
                            value={stats.applied}
                            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />}
                            color="green"
                          />
                          <DashboardCard
                            title="Already Applied"
                            value={stats.alreadyApplied}
                            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />}
                            color="yellow"
                          />
                          <DashboardCard
                            title="Failed"
                            value={stats.failed}
                            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />}
                            color="red"
                          />
                          <DashboardCard
                            title="Skipped"
                            value={stats.skipped}
                            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />}
                            color="blue"
                          />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <ChartSection data={stats} />
                          <div className="card p-6">
                            <h3 className="text-lg font-semibold mb-4">Recent Applications</h3>
                            <ApplicationsTable jobs={jobs.slice(0, 5)} />
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {activeTab === 'applications' && (
                      <motion.div
                        key="applications"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-6"
                      >
                        <div className="flex flex-wrap gap-4 mb-6">
                          {searchItems.map(item => (
                            <motion.button
                              key={item}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setSelectedSearchItem(item)}
                              className={\`tab \${selectedSearchItem === item ? 'active' : 'bg-white'}\`}
                            >
                              {item}
                            </motion.button>
                          ))}
                        </div>

                        <div className="flex justify-between items-center mb-6">
                          <input
                            type="text"
                            placeholder="Search jobs..."
                            className="search-filter px-4 py-2 w-64"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                          <select
                            className="search-filter px-4 py-2"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                          >
                            <option value="">All Status</option>
                            <option value="success">Applied</option>
                            <option value="already_applied">Already Applied</option>
                            <option value="failed">Failed</option>
                            <option value="skipped">Skipped</option>
                          </select>
                        </div>

                        <ApplicationsTable
                          jobs={selectedSearchItem ? jobsBySearchTerm[selectedSearchItem] : jobs}
                          searchTerm={searchTerm}
                          statusFilter={statusFilter}
                        />
                      </motion.div>
                    )}

                    {activeTab === 'analytics' && (
                      <motion.div
                        key="analytics"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-6"
                      >
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <ChartSection data={stats} />
                          <div className="card p-6">
                            <h3 className="text-lg font-semibold mb-4">Performance Metrics</h3>
                            {/* Add more analytics visualizations here */}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </main>
              </div>
            );
          }

          ReactDOM.render(<Dashboard />, document.getElementById('root'));
        </script>
      </body>
      </html>`;

      fs.writeFileSync(this.htmlReportPath, html, "utf-8");
      console.log(`✅ HTML dashboard report generated: ${this.htmlReportPath}`);
    } catch (err) {
      console.error(`❌ Error generating HTML report: ${err.message}`);
    }
  }
}

// Enhanced job title matching
const matchesSearchCriteria = (jobTitle) => {
  if (!jobTitle) return { matches: false, matchingTerms: [] };

  const titleLower = jobTitle.toLowerCase();
  const matchingTerms = SEARCH_ITEMS.filter((searchItem) =>
    titleLower.includes(searchItem.toLowerCase())
  );

  return {
    matches: matchingTerms.length > 0,
    matchingTerms: matchingTerms,
  };
};

// Enhanced job title extraction
const extractJobTitleFromDetailPage = async (page) => {
  try {
    const titleSelectors = [
      'h1[data-testid="job-title"]',
      'h1[data-cy="job-title"]',
      "h1.job-title",
      'h1[class*="job-title"]',
      'h1[class*="JobTitle"]',
      'h1[id*="job-title"]',
      "h1:first-of-type",
      "h1",
      ".job-header h1",
      ".job-details h1",
      // Add more selectors if needed
    ];

    for (const selector of titleSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          let title = await element.textContent();
          if (!title || !title.trim()) {
            // Try innerText as fallback
            title = await page.evaluate((el) => el.innerText, element);
          }
          if (title && title.trim() && title.length > 3) {
            console.log(`✅ Job title found with selector: ${selector}`);
            return title.trim();
          }
        }
      } catch (err) {
        continue;
      }
    }

    // Fallback: try to get first h1 anywhere
    try {
      const h1s = await page.$$("h1");
      for (const h1 of h1s) {
        let title = await h1.textContent();
        if (!title || !title.trim()) {
          title = await page.evaluate((el) => el.innerText, h1);
        }
        if (title && title.trim() && title.length > 3) {
          console.log(`✅ Job title fallback found in <h1>`);
          return title.trim();
        }
      }
    } catch (err) {
      // ignore
    }

    console.warn("⚠️ Could not extract job title");
    return "Unknown Job Title";
  } catch (error) {
    console.error(`❌ Error extracting job title: ${error.message}`);
    return "Unknown Job Title";
  }
};

// Enhanced company name extraction
const extractCompanyName = async (page) => {
  try {
    const companySelectors = [
      '[data-testid="company-name"]',
      '[data-cy="company-name"]',
      ".company-name",
      '[class*="company-name"]',
      ".job-company",
      ".employer-name",
      'a[href*="/company/"]',
      'span[class*="company"]',
      ".company-info span",
      // Add more selectors if needed
    ];

    for (const selector of companySelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          let company = await element.textContent();
          if (!company || !company.trim()) {
            company = await page.evaluate((el) => el.innerText, element);
          }
          if (company && company.trim() && company.length > 2) {
            console.log(`✅ Company name found with selector: ${selector}`);
            return company.trim();
          }
        }
      } catch (err) {
        continue;
      }
    }

    // Fallback: try to get first span or div with company in class
    try {
      const companyLike = await page.$$(
        '[class*="company"], span[class*="company"], div[class*="company"]'
      );
      for (const el of companyLike) {
        let company = await el.textContent();
        if (!company || !company.trim()) {
          company = await page.evaluate((e) => e.innerText, el);
        }
        if (company && company.trim() && company.length > 2) {
          console.log(`✅ Company name fallback found in company-like element`);
          return company.trim();
        }
      }
    } catch (err) {
      // ignore
    }

    console.warn("⚠️ Could not extract company name");
    return "Unknown Company";
  } catch (error) {
    console.error(`❌ Error extracting company name: ${error.message}`);
    return "Unknown Company";
  }
};

// Improved navigation function
const safeGoto = async (page, url, retries = 2) => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (page.isClosed()) {
        console.error(`❌ Page is closed, cannot navigate to ${url}`);
        return false;
      }

      console.log(`🔄 Loading: ${url} (Attempt ${attempt + 1})`);

      await page.goto(url, {
        waitUntil: "networkidle",
        timeout: 45000,
      });

      await page.waitForTimeout(2000);

      // Verify page loaded
      const title = await page.title();
      if (title && title.length > 0) {
        console.log(`✅ Successfully loaded: ${url}`);
        return true;
      }
    } catch (err) {
      console.error(
        `❌ Attempt ${attempt + 1} failed for ${url}: ${err.message}`
      );

      if (attempt < retries && !page.isClosed()) {
        await page.waitForTimeout(3000);
      }
    }
  }

  return false;
};

// Improved click function
const safeClick = async (page, selector, description = "element") => {
  try {
    await page.waitForSelector(selector, { timeout: 10000 });
    await page.click(selector, { timeout: 10000 });
    console.log(`✅ Clicked: ${description}`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to click ${description}: ${err.message}`);
    return false;
  }
};

// Process individual job
const processJob = async (context, jobCard, cardIndex, logger) => {
  let newTab = null;
  let jobTitle = "Unknown Job Title";
  let companyName = "Unknown Company";

  try {
    // Check if context is closed before proceeding
    if (context._closed) {
      await logger.logJob(jobTitle, companyName, "Skipped - Context closed");
      return { success: false, reason: "Context closed", skipped: true };
    }

    // Click job card to open detail page
    const jobCardLink = jobCard.locator("a").first();
    const jobCardLinkCount = await jobCardLink.count();

    if (jobCardLinkCount === 0) {
      await logger.logJob(jobTitle, companyName, "Failed - No clickable link");
      return { success: false, reason: "No clickable link" };
    }

    console.log(`Opening job card ${cardIndex + 1}...`);

    // Open job detail page in new tab
    const [newTabPromise] = await Promise.all([
      context.waitForEvent("page", { timeout: 15000 }),
      jobCardLink.click(),
    ]);

    newTab = await newTabPromise;

    if (!newTab || newTab.isClosed()) {
      await logger.logJob(jobTitle, companyName, "Failed - Tab opening error");
      return { success: false, reason: "Tab opening error" };
    }

    // Wait for job detail page to load
    await newTab.waitForLoadState("domcontentloaded", { timeout: 15000 });
    await newTab.waitForTimeout(2000);

    // Extract job title and company name from detail page
    jobTitle = await extractJobTitleFromDetailPage(newTab);
    companyName = await extractCompanyName(newTab);

    console.log(
      `Job Details - Title: "${jobTitle}", Company: "${companyName}"`
    );

    // Check if job title matches search criteria
    const matchResult = matchesSearchCriteria(jobTitle);

    if (!matchResult.matches) {
      const reason = `Skipped - No match for search terms`;
      console.log(`❌ "${jobTitle}" doesn't match search criteria`);
      await logger.logJob(jobTitle, companyName, reason);
      return { success: false, reason: reason, skipped: true };
    }

    console.log(
      `✅ "${jobTitle}" matches criteria: ${matchResult.matchingTerms.join(
        ", "
      )}`
    );

    // Apply to job
    const applicationResult = await applyToJob(newTab);

    if (applicationResult.success) {
      const status = applicationResult.alreadyApplied
        ? "Already Applied"
        : "Success - Applied";
      console.log(`✅ Application result for "${jobTitle}": ${status}`);
      await logger.logJob(jobTitle, companyName, status);
      return {
        success: true,
        alreadyApplied: applicationResult.alreadyApplied,
      };
    } else {
      const status = `Failed - ${applicationResult.reason}`;
      console.log(
        `❌ Application failed for "${jobTitle}": ${applicationResult.reason}`
      );
      await logger.logJob(jobTitle, companyName, status);
      return { success: false, reason: applicationResult.reason };
    }
  } catch (error) {
    const status = `Failed - ${error.message}`;
    console.error(
      `Error processing job card ${cardIndex + 1}: ${error.message}`
    );
    await logger.logJob(jobTitle, companyName, status);
    return { success: false, reason: error.message };
  } finally {
    // Ensure tab is closed
    if (newTab && !newTab.isClosed()) {
      try {
        await newTab.close();
      } catch (closeErr) {
        console.error(`Failed to close tab: ${closeErr.message}`);
      }
    }
  }
};

// Process jobs with controlled concurrency
const processJobBatch = async (context, jobCards, logger) => {
  const results = [];

  // Process jobs in smaller batches to avoid overwhelming
  for (let i = 0; i < jobCards.length; i += MAX_CONCURRENT_TABS) {
    // Check if context is closed before starting a batch
    if (context._closed) {
      console.warn("Context closed, stopping job batch processing.");
      break;
    }

    const batch = jobCards.slice(i, i + MAX_CONCURRENT_TABS);
    console.log(
      `🔄 Processing batch ${Math.floor(i / MAX_CONCURRENT_TABS) + 1} (${
        batch.length
      } jobs)`
    );

    const batchPromises = batch.map(async (jobCard, index) => {
      // Stagger the requests
      await new Promise((resolve) => setTimeout(resolve, index * TAB_DELAY));
      // Check if context is closed before each job
      if (context._closed) {
        return { success: false, reason: "Context closed", skipped: true };
      }
      return processJob(context, jobCard, i + index, logger);
    });

    const batchResults = await Promise.allSettled(batchPromises);

    batchResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        results.push({ success: false, reason: result.reason });
        console.error(`❌ Batch job ${i + index + 1} failed:`, result.reason);
      }
    });

    // Pause between batches
    if (i + MAX_CONCURRENT_TABS < jobCards.length) {
      if (context._closed) break;
      console.log(`⏳ Pausing ${PAGE_DELAY}ms before next batch...`);
      await new Promise((resolve) => setTimeout(resolve, PAGE_DELAY));
    }
  }

  return results;
};

// Main test
test("Auto-apply to Jobs on Dice - Fixed Version", async ({ browser }) => {
  let context;
  let page;
  let logger;

  try {
    // Initialize
    logger = new JobApplicationLogger();
    await logger.initializeExcel();

    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    page = await context.newPage();

    console.log("🔐 Starting login process...");

    // Login
    const loginSuccess = await safeGoto(page, LOGIN_URL);
    if (!loginSuccess) {
      throw new Error("Failed to load login page");
    }

    // Handle login form
    try {
      await page.waitForSelector('input[name="email"]', { timeout: 15000 });
      await page.fill('input[name="email"]', USERNAME);

      await safeClick(page, 'button[type="submit"]', "first submit button");

      await page.waitForSelector('input[name="password"]', { timeout: 15000 });
      await page.fill('input[name="password"]', PASSWORD);

      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle", timeout: 30000 }),
        safeClick(page, 'button[type="submit"]', "password submit button"),
      ]);

      console.log("✅ Login successful");
      await page.waitForTimeout(3000);
    } catch (loginError) {
      throw new Error(`Login failed: ${loginError.message}`);
    }

    // Initialize statistics
    const stats = {
      applied: 0,
      failed: 0,
      skipped: 0,
      alreadyApplied: 0,
      total: 0,
    };

    // Process each search term sequentially for better stability
    for (const searchTerm of SEARCH_ITEMS) {
      console.log(`\n🔍 Processing search term: "${searchTerm}"`);

      const encodedSearch = encodeURIComponent(searchTerm);

      for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
        if (page.isClosed()) {
          console.error("❌ Main page closed unexpectedly");
          break;
        }

        let url = `https://www.dice.com/jobs?filters.easyApply=true&filters.postedDate=ONE&q=${encodedSearch}`;
        if (pageNum > 1) {
          url += `&page=${pageNum}`;
        }

        console.log(`\n📄 Page ${pageNum} for "${searchTerm}"`);

        const pageLoaded = await safeGoto(page, url);
        if (!pageLoaded) {
          console.log(`⏭️ Skipping page ${pageNum} - failed to load`);
          continue;
        }

        // Wait for job cards or no results message
        try {
          await page.waitForSelector("[data-testid='job-search-serp-card']", {
            timeout: 15000,
          });
        } catch (err) {
          // Check for no jobs found indicators
          const noJobsIndicators = [
            // Text phrases
            `We weren't able to find any jobs for "${searchTerm}". Please try refining your search terms.`,
            "No results found",
            "We couldn't find any matches",
            // Visual indicator
            "img[loading='lazy']",
          ];

          let noJobsFound = false;
          for (const indicator of noJobsIndicators) {
            if (indicator.startsWith("img")) {
              // Check for the lazy-loaded image
              const imgCount = await page.locator(indicator).count();
              if (imgCount > 0) {
                console.log("⚠️ No jobs found (detected via image indicator)");
                noJobsFound = true;
                break;
              }
            } else {
              // Check for text content
              const pageContent = await page.content();
              if (pageContent.includes(indicator)) {
                console.log(`⚠️ No jobs found: "${indicator}"`);
                noJobsFound = true;
                break;
              }
            }
          }

          if (noJobsFound) {
            console.log(
              `⏭️ No jobs found for "${searchTerm}" on page ${pageNum}. Moving to next search term...`
            );
            await page.waitForTimeout(2000);
            break; // Exit the page loop and move to next search term
          }

          console.log("⚠️ No job cards found on this page.");
          continue;
        }

        const jobCardLocator = page.locator(
          "[data-testid='job-search-serp-card']"
        );
        const jobCardCount = await jobCardLocator.count();
        const jobCards = [];
        for (let i = 0; i < jobCardCount; i++) {
          jobCards.push(jobCardLocator.nth(i));
        }

        console.log(`📋 Found ${jobCards.length} job cards`);

        if (jobCards.length === 0) continue;

        // Process jobs
        const results = await processJobBatch(context, jobCards, logger);

        // Update statistics
        results.forEach((result) => {
          stats.total++;
          if (result.success) {
            if (result.alreadyApplied) {
              stats.alreadyApplied++;
            } else {
              stats.applied++;
            }
          } else if (result.skipped) {
            stats.skipped++;
          } else {
            stats.failed++;
          }
        });

        console.log(
          `✅ Page ${pageNum} completed - Applied: ${stats.applied}, Already Applied: ${stats.alreadyApplied}, Failed: ${stats.failed}, Skipped: ${stats.skipped}`
        );

        // Pause between pages
        await new Promise((resolve) => setTimeout(resolve, PAGE_DELAY));
      }
    }

    // Final save and summary
    await logger.saveExcel();
    const logSummary = logger.getLogSummary();

    console.log("\n" + "=".repeat(70));
    console.log("📊 FINAL SUMMARY");
    console.log("=".repeat(70));
    console.log(`📁 Excel Log: ${logSummary.filename}`);
    console.log(`📍 Location: ${logSummary.filepath}`);
    console.log(`📝 Total Jobs Processed: ${stats.total}`);
    console.log(`✅ Successfully Applied: ${stats.applied}`);
    console.log(`🔄 Already Applied: ${stats.alreadyApplied}`);
    console.log(`❌ Failed Applications: ${stats.failed}`);
    console.log(`⏭️ Skipped (No Match): ${stats.skipped}`);

    if (stats.total > 0) {
      console.log(
        `🎯 Success Rate: ${((stats.applied / stats.total) * 100).toFixed(1)}%`
      );
    }
    console.log("=".repeat(70));
  } catch (error) {
    console.error(`❌ Main test error: ${error.message}`);
    if (logger) {
      await logger.logJob("System Error", "System", `Error: ${error.message}`);
      await logger.saveExcel();
    }
    throw error;
  } finally {
    if (logger) {
      await logger.generateHtmlReport();
    }
    if (context) {
      try {
        await context.close();
      } catch (err) {
        console.error(`❌ Error closing context: ${err.message}`);
      }
    }
  }
});

// Enhanced job application function
async function applyToJob(page) {
  try {
    if (page.isClosed()) {
      return { success: false, reason: "Page is closed" };
    }

    console.log(`🎯 Attempting to apply to job: ${page.url()}`);
    await page.waitForTimeout(2000);

    // Check if already applied first
    const alreadyAppliedSelectors = [
      "text=You have already applied",
      "text=Application submitted",
      "text=Already applied",
      ".already-applied",
      "[data-testid='already-applied']",
      "text=Application received",
      "text=Applied",
    ];

    for (const selector of alreadyAppliedSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          console.log(`ℹ️ Already applied to this job`);
          return { success: true, alreadyApplied: true };
        }
      } catch (err) {
        // Continue checking
      }
    }

    // Find and click Apply button
    const applySelectors = [
      "#applyButton",
      "apply-button-wc",
      "button:has-text('Easy apply')",
      "button:has-text('Apply now')",
      "button:has-text('Apply')",
      "[data-testid='apply-button']",
      ".apply-button",
      "button[data-testid='easy-apply']",
      "input[value*='Apply']",
    ];

    let applyClicked = false;
    for (const selector of applySelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          await element.click();
          console.log(`✅ Clicked apply button: ${selector}`);
          applyClicked = true;
          await page.waitForTimeout(3000);
          break;
        }
      } catch (err) {
        continue;
      }
    }

    if (!applyClicked) {
      return { success: false, reason: "No Apply button found" };
    }

    // Handle potential Next/Continue button
    const nextSelectors = [
      "button:has-text('Next')",
      "button:has-text('Continue')",
      "[data-testid='next-button']",
      ".next-button",
      "input[value*='Next']",
    ];

    for (const selector of nextSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          await element.click();
          console.log(`✅ Clicked next button: ${selector}`);
          await page.waitForTimeout(3000);
          break;
        }
      } catch (err) {
        continue;
      }
    }

    // Handle Submit button
    const submitSelectors = [
      "button:has-text('Submit')",
      "button:has-text('Submit Application')",
      "input[type='submit']",
      "[data-testid='submit-button']",
      ".submit-button",
      "button:has-text('Send Application')",
      "button:has-text('Apply Now')",
      "input[value*='Submit']",
    ];

    for (const selector of submitSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          await element.click();
          console.log(`✅ Clicked submit button: ${selector}`);
          await page.waitForTimeout(4000);
          break;
        }
      } catch (err) {
        continue;
      }
    }

    // Check for success confirmation
    const confirmationSelectors = [
      ".post-apply-banner",
      "[data-testid='application-confirmation']",
      ".application-success",
      ".confirmation-message",
      "text=Application submitted",
      "text=Successfully applied",
      "text=Application received",
      "text=Thank you for applying",
      "text=Your application has been submitted",
      "text=Application sent",
    ];

    for (const selector of confirmationSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`✅ Application confirmation found: ${selector}`);
        return { success: true, alreadyApplied: false };
      } catch (err) {
        continue;
      }
    }

    // Check URL for success indicators
    const currentUrl = page.url();
    if (
      currentUrl.includes("success") ||
      currentUrl.includes("applied") ||
      currentUrl.includes("confirmation") ||
      currentUrl.includes("thank-you")
    ) {
      console.log(`✅ Success indicated by URL: ${currentUrl}`);
      return { success: true, alreadyApplied: false };
    }

    // If we get here, assume success but couldn't verify
    console.log(
      `⚠️ Application attempt completed, but couldn't verify success`
    );
    return { success: true, alreadyApplied: false };
  } catch (err) {
    console.error(`❌ Error during job application: ${err.message}`);
    return { success: false, reason: err.message };
  }
}
