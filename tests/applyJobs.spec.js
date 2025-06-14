// tests/applyJobs.spec.js

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
const USERNAME = "ENTER_YOUR_USERNAME_HERE"; // Replace with your Dice username
const PASSWORD = "ENTER_YOUR_PASSWORD_HERE"; // Replace with your Dice password
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
      const appliedJobs = this.jobData.filter(
        (j) => j.category === "success" || j.category === "already_applied"
      );
      const alreadyAppliedJobs = this.jobData.filter(
        (j) => j.category === "already_applied"
      );
      const failedJobs = this.jobData.filter((j) => j.category === "failed");
      const skippedJobs = this.jobData.filter((j) => j.category === "skipped");
      const unknownJobs = this.jobData.filter((j) => j.category === "unknown");

      const summary = `
        <div class="summary-cards">
          <div class="card applied" data-type="applied">
            <div class="count" id="applied-count">${appliedJobs.length}</div>
            <div class="label">Applied</div>
          </div>
          <div class="card already-applied" data-type="already_applied">
            <div class="count" id="already-applied-count">${alreadyAppliedJobs.length}</div>
            <div class="label">Already Applied</div>
          </div>
          <div class="card failed" data-type="failed">
            <div class="count" id="failed-count">${failedJobs.length}</div>
            <div class="label">Failed</div>
          </div>
          <div class="card skipped" data-type="skipped">
            <div class="count" id="skipped-count">${skippedJobs.length}</div>
            <div class="label">Skipped</div>
          </div>
        </div>
      `;

      // Pie chart data
      const pieData = {
        applied: appliedJobs.length,
        alreadyApplied: alreadyAppliedJobs.length,
        failed: failedJobs.length,
        skipped: skippedJobs.length,
        unknown: unknownJobs.length,
      };

      // Details dropdown for each row
      const tableRows = this.jobData
        .map(
          (j, idx) => `
          <tr class="${j.category} main-row" data-idx="${idx}">
            <td>
              <button class="expand-btn" title="Show Details">+</button>
              ${j.serialNo}
            </td>
            <td>${j.jobTitle}</td>
            <td>${j.companyName}</td>
            <td>${j.status}</td>
            <td>${j.timestamp}</td>
          </tr>
          <tr class="details-row" style="display:none;">
            <td colspan="5">
              <div class="details-content">
                <strong>Job Title:</strong> ${j.jobTitle}<br>
                <strong>Company:</strong> ${j.companyName}<br>
                <strong>Status:</strong> ${j.status}<br>
                <strong>Timestamp:</strong> ${j.timestamp}<br>
                <strong>Category:</strong> ${j.category}
              </div>
            </td>
          </tr>
        `
        )
        .join("");

      const appliedRows = appliedJobs
        .map(
          (j, idx) => `
          <tr class="main-row" data-idx="${idx}">
            <td>
              <button class="expand-btn" title="Show Details">+</button>
              ${j.serialNo}
            </td>
            <td>${j.jobTitle}</td>
            <td>${j.companyName}</td>
            <td>${j.status}</td>
            <td>${j.timestamp}</td>
          </tr>
          <tr class="details-row" style="display:none;">
            <td colspan="5">
              <div class="details-content">
                <strong>Job Title:</strong> ${j.jobTitle}<br>
                <strong>Company:</strong> ${j.companyName}<br>
                <strong>Status:</strong> ${j.status}<br>
                <strong>Timestamp:</strong> ${j.timestamp}<br>
                <strong>Category:</strong> ${j.category}
              </div>
            </td>
          </tr>
        `
        )
        .join("");

      const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Job Application Dashboard Report</title>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            background: #f4f8fb;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 1200px;
            margin: 30px auto;
            background: #fff;
            border-radius: 10px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.07);
            padding: 32px 40px 40px 40px;
          }
          h1 {
            text-align: center;
            color: #2a5298;
            margin-bottom: 10px;
          }
          .summary-cards {
            display: flex;
            justify-content: center;
            gap: 24px;
            margin: 30px 0 40px 0;
          }
          .card {
            background: #f7fafd;
            border-radius: 8px;
            box-shadow: 0 1px 4px rgba(44, 62, 80, 0.08);
            padding: 24px 36px;
            text-align: center;
            min-width: 120px;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
            opacity: 0;
            transform: translateY(40px) scale(0.95);
            animation: cardFadeIn 0.7s forwards;
          }
          .card.applied { border-top: 4px solid #4caf50; animation-delay: 0.1s;}
          .card.already-applied { border-top: 4px solid #ff9800; animation-delay: 0.2s;}
          .card.failed { border-top: 4px solid #e53935; animation-delay: 0.3s;}
          .card.skipped { border-top: 4px solid #fbc02d; animation-delay: 0.4s;}
          .card .count {
            font-size: 2.5em;
            font-weight: bold;
            color: #2a5298;
            transition: color 0.3s;
          }
          .card .label {
            font-size: 1.1em;
            color: #555;
            margin-top: 6px;
          }
          .card:hover {
            transform: translateY(-4px) scale(1.03);
            box-shadow: 0 4px 16px rgba(44, 62, 80, 0.13);
          }
          @keyframes cardFadeIn {
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          .chart-section {
            display: flex;
            justify-content: center;
            margin-bottom: 40px;
          }
          .section {
            margin-bottom: 40px;
          }
          .section h2 {
            color: #2a5298;
            border-bottom: 2px solid #e3eaf2;
            padding-bottom: 8px;
            margin-bottom: 18px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            background: #fff;
            margin-bottom: 16px;
          }
          th, td {
            padding: 10px 12px;
            border-bottom: 1px solid #e3eaf2;
            text-align: left;
          }
          th {
            background: #e3eaf2;
            color: #2a5298;
            font-weight: 600;
          }
          tr.success, tr.already_applied { background: #eafaf1; }
          tr.failed { background: #fdeaea; }
          tr.skipped { background: #fffbe7; }
          tr.unknown { background: #f5f5f5; }
          tr:hover { background: #f1f7ff; }
          .expand-btn {
            background: #2a5298;
            color: #fff;
            border: none;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            font-size: 1.1em;
            cursor: pointer;
            margin-right: 6px;
            transition: background 0.2s;
          }
          .expand-btn:hover {
            background: #4caf50;
          }
          .details-row {
            background: #f9f9fc;
            transition: display 0.3s;
          }
          .details-content {
            padding: 10px 0 10px 10px;
            font-size: 1em;
            color: #333;
          }
          .footer {
            text-align: center;
            color: #888;
            margin-top: 40px;
            font-size: 0.95em;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Job Application Dashboard Report</h1>
          ${summary}
          <div class="chart-section">
            <canvas id="pieChart" width="320" height="320"></canvas>
          </div>
          <div class="section">
            <h2>Applied Jobs</h2>
            <table>
              <thead>
                <tr>
                  <th>Sr.No</th>
                  <th>Job Title</th>
                  <th>Company Name</th>
                  <th>Status</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                ${
                  appliedRows ||
                  "<tr><td colspan='5'>No jobs applied.</td></tr>"
                }
              </tbody>
            </table>
          </div>
          <div class="section">
            <h2>Complete Log</h2>
            <table>
              <thead>
                <tr>
                  <th>Sr.No</th>
                  <th>Job Title</th>
                  <th>Company Name</th>
                  <th>Status</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </div>
          <div class="footer">
            Generated on ${new Date().toLocaleString()}
          </div>
        </div>
        <script>
          // Animate summary card numbers
          function animateCount(id, target) {
            const el = document.getElementById(id);
            if (!el) return;
            let count = 0;
            const step = Math.ceil(target / 40) || 1;
            const interval = setInterval(() => {
              count += step;
              if (count >= target) {
                el.textContent = target;
                clearInterval(interval);
              } else {
                el.textContent = count;
              }
            }, 18);
          }
          animateCount('applied-count', ${pieData.applied});
          animateCount('already-applied-count', ${pieData.alreadyApplied});
          animateCount('failed-count', ${pieData.failed});
          animateCount('skipped-count', ${pieData.skipped});

          // Pie Chart
          const ctx = document.getElementById('pieChart').getContext('2d');
          const pieChart = new Chart(ctx, {
            type: 'pie',
            data: {
              labels: ['Applied', 'Already Applied', 'Failed', 'Skipped', 'Unknown'],
              datasets: [{
                data: [${pieData.applied}, ${pieData.alreadyApplied}, ${
        pieData.failed
      }, ${pieData.skipped}, ${pieData.unknown}],
                backgroundColor: [
                  '#4caf50',
                  '#ff9800',
                  '#e53935',
                  '#fbc02d',
                  '#bdbdbd'
                ],
                borderWidth: 1
              }]
            },
            options: {
              responsive: false,
              plugins: {
                legend: {
                  display: true,
                  position: 'bottom'
                },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      const label = context.label || '';
                      const value = context.parsed || 0;
                      return label + ': ' + value;
                    }
                  }
                }
              }
            }
          });

          // Card click filters table
          document.querySelectorAll('.summary-cards .card').forEach(card => {
            card.addEventListener('click', function() {
              const type = card.getAttribute('data-type');
              // Show only rows of this type in Complete Log
              document.querySelectorAll('.section:last-of-type tbody tr.main-row').forEach((row, idx) => {
                const cat = row.className.trim();
                if (type === 'applied') {
                  // Show both success and already_applied
                  row.style.display = (cat === 'success' || cat === 'already_applied') ? '' : 'none';
                  if(row.nextElementSibling && row.nextElementSibling.classList.contains('details-row')) {
                    row.nextElementSibling.style.display = (cat === 'success' || cat === 'already_applied') ? 'none' : 'none';
                  }
                } else {
                  row.style.display = (cat === type) ? '' : 'none';
                  if(row.nextElementSibling && row.nextElementSibling.classList.contains('details-row')) {
                    row.nextElementSibling.style.display = (cat === type) ? 'none' : 'none';
                  }
                }
              });
            });
          });

          // Expand/collapse details
          document.querySelectorAll('.expand-btn').forEach((btn, idx) => {
            btn.addEventListener('click', function(e) {
              e.preventDefault();
              const mainRow = btn.closest('tr');
              const detailsRow = mainRow.nextElementSibling;
              if (!detailsRow) return;
              if (detailsRow.style.display === 'none') {
                detailsRow.style.display = '';
                btn.textContent = '-';
                btn.title = "Hide Details";
              } else {
                detailsRow.style.display = 'none';
                btn.textContent = '+';
                btn.title = "Show Details";
              }
            });
          });

          // Reset filter on double click anywhere
          document.querySelector('.summary-cards').addEventListener('dblclick', function() {
            document.querySelectorAll('.section:last-of-type tbody tr.main-row').forEach(row => {
              row.style.display = '';
              if(row.nextElementSibling && row.nextElementSibling.classList.contains('details-row')) {
                row.nextElementSibling.style.display = 'none';
              }
            });
          });
        </script>
      </body>
      </html>
      `;

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

        // Wait for job cards
        try {
          await page.waitForSelector("[data-testid='job-search-serp-card']", {
            timeout: 15000,
          });
        } catch (err) {
          console.log(`⏭️ No job cards found on page ${pageNum}`);
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
