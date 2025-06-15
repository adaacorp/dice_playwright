// tests/applyJobs.spec.js

const { test, expect } = require("@playwright/test");
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");

const SEARCH_ITEMS = [
  // Focus on most relevant QA/Testing roles to reduce total jobs processed
  "Software Tester",
  "QA",
  "Automation",
  "SDET",
  "Performance",
  "Manual Tester",
];

const MAX_PAGES = 1; // Reduced for faster execution
const LOGIN_URL = "https://www.dice.com/dashboard/login";
const USERNAME = "amar.sdet1@gmail.com"; // Replace with your Dice username
const PASSWORD = "Admin@lcl25"; // Replace with your Dice password
const MAX_CONCURRENT_TABS = 3; // Increased concurrency for speed
const TAB_DELAY = 1000; // Reduced delay between tabs
const PAGE_DELAY = 1500; // Reduced delay between pages

// Increased test timeout (optional, but should not be needed with above changes)
test.setTimeout(7200000); // 2 hours

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
      // Group jobs by search term
      const jobsBySearch = {};
      for (const search of SEARCH_ITEMS) {
        jobsBySearch[search] = [];
      }
      for (const job of this.jobData) {
        // Try to match job to a search term
        const found = SEARCH_ITEMS.find((term) =>
          (job.jobTitle || "").toLowerCase().includes(term.toLowerCase())
        );
        if (found) jobsBySearch[found].push(job);
        else {
          // If not matched, put in first group
          jobsBySearch[SEARCH_ITEMS[0]].push(job);
        }
      }

      // Summary counts
      const appliedJobs = this.jobData.filter(
        (j) => j.category === "success" || j.category === "already_applied"
      );
      const alreadyAppliedJobs = this.jobData.filter(
        (j) => j.category === "already_applied"
      );
      const failedJobs = this.jobData.filter((j) => j.category === "failed");
      const skippedJobs = this.jobData.filter((j) => j.category === "skipped");
      const unknownJobs = this.jobData.filter((j) => j.category === "unknown");

      // Cards
      const summaryCards = `
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div class="bg-gray-700 p-6 rounded-lg shadow">
            <h3 class="text-xl font-medium mb-2">Applied</h3>
            <p class="text-3xl font-bold">${appliedJobs.length}</p>
          </div>
          <div class="bg-gray-700 p-6 rounded-lg shadow">
            <h3 class="text-xl font-medium mb-2">Already Applied</h3>
            <p class="text-3xl font-bold">${alreadyAppliedJobs.length}</p>
          </div>
          <div class="bg-gray-700 p-6 rounded-lg shadow">
            <h3 class="text-xl font-medium mb-2">Failed</h3>
            <p class="text-3xl font-bold">${failedJobs.length}</p>
          </div>
          <div class="bg-gray-700 p-6 rounded-lg shadow">
            <h3 class="text-xl font-medium mb-2">Skipped</h3>
            <p class="text-3xl font-bold">${skippedJobs.length}</p>
          </div>
        </div>
      `;

      // Collapsible sections for each SEARCH_ITEM
      let searchSections = "";
      for (const search of SEARCH_ITEMS) {
        const jobs = jobsBySearch[search];
        searchSections += `
        <div class="mb-4">
          <button class="w-full flex justify-between items-center bg-gray-800 px-4 py-3 rounded-t-lg focus:outline-none group" onclick="const c=document.getElementById('section-${search.replace(
            /\s+/g,
            "-"
          )}');c.style.display=c.style.display==='none'?'':'none';this.querySelector('svg').classList.toggle('rotate-180')">
            <span class="text-lg font-semibold">${search} <span class="ml-2 text-xs text-gray-400">(${
          jobs.length
        })</span></span>
            <svg class="w-5 h-5 ml-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          </button>
          <div id="section-${search.replace(
            /\s+/g,
            "-"
          )}" class="bg-gray-700 rounded-b-lg p-4" style="display:none;">
            <div class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead>
                  <tr class="bg-gray-600">
                    <th class="px-3 py-2">#</th>
                    <th class="px-3 py-2">Job Title</th>
                    <th class="px-3 py-2">Company</th>
                    <th class="px-3 py-2">Status</th>
                    <th class="px-3 py-2">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  ${jobs
                    .map(
                      (j) => `
                    <tr class="border-b border-gray-600 ${j.category}">
                      <td class="px-3 py-2">${j.serialNo}</td>
                      <td class="px-3 py-2">${j.jobTitle}</td>
                      <td class="px-3 py-2">${j.companyName}</td>
                      <td class="px-3 py-2">${j.status}</td>
                      <td class="px-3 py-2">${j.timestamp}</td>
                    </tr>
                  `
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        `;
      }

      // HTML
      const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>DashDarkX - Job Dashboard</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-900 text-gray-100 font-sans">
        <div class="flex min-h-screen">
          <aside class="w-64 bg-gray-800 p-5">
            <h1 class="text-2xl font-bold mb-8">DashDarkX</h1>
            <nav class="space-y-4">
              <a href="#" class="block py-2 px-4 rounded hover:bg-gray-700">Dashboard</a>
              <a href="#" class="block py-2 px-4 rounded hover:bg-gray-700">Analytics</a>
              <a href="#" class="block py-2 px-4 rounded hover:bg-gray-700">Reports</a>
              <a href="#" class="block py-2 px-4 rounded hover:bg-gray-700">Settings</a>
            </nav>
          </aside>
          <main class="flex-1 p-10">
            <header class="mb-6">
              <h2 class="text-3xl font-semibold">Overview</h2>
            </header>
            ${summaryCards}
            <div class="bg-gray-700 p-6 rounded-lg shadow mb-8">
              <h3 class="text-xl font-medium mb-4">Traffic Overview</h3>
              <div class="h-64 bg-gray-600 flex items-center justify-center rounded">
                <span class="text-gray-400">[Chart goes here]</span>
              </div>
            </div>
            <h2 class="text-2xl font-semibold mb-4">Jobs by Search Term</h2>
            ${searchSections}
            <div class="mt-10 text-center text-gray-400 text-xs">Generated on ${new Date().toLocaleString()}</div>
          </main>
        </div>
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

// --- AI Agent/Eval Function ---
function aiEvaluateJob(jobTitle, companyName) {
  // Example logic: you can replace this with a call to an LLM or external API
  const title = (jobTitle || "").toLowerCase();
  const company = (companyName || "").toLowerCase();

  // Example: skip if title contains "intern" or "junior"
  if (title.includes("intern") || title.includes("junior")) return "skip";
  // Example: flag for review if company is "consulting"
  if (company.includes("consulting")) return "review";
  // Otherwise, apply if matches search criteria
  return "apply";
}

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

    // --- AI Agent/Eval decision ---
    const aiDecision = aiEvaluateJob(jobTitle, companyName);
    if (aiDecision === "skip") {
      const reason = `Skipped - AI Agent decision`;
      console.log(`🤖 AI Agent: Skipping "${jobTitle}"`);
      await logger.logJob(jobTitle, companyName, reason);
      return { success: false, reason: reason, skipped: true };
    }
    if (aiDecision === "review") {
      const reason = `Flagged for Review - AI Agent decision`;
      console.log(`🤖 AI Agent: Flagged "${jobTitle}" for review`);
      await logger.logJob(jobTitle, companyName, reason);
      return { success: false, reason: reason, skipped: true };
    }

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

// Track progress for resuming
let currentSearchIdx = 0;
let currentPageNum = 1;

// Utility to clear browser storage (cookies, localStorage, etc.)
async function clearBrowserStorage(browser) {
  const contexts = browser.contexts();
  for (const ctx of contexts) {
    try {
      await ctx.clearCookies();
      await ctx.clearPermissions();
      // Optionally, clear local/session storage for each page
      for (const page of ctx.pages()) {
        try {
          await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
          });
        } catch {}
      }
      await ctx.close();
    } catch {}
  }
}

// Main test with self-healing
test("Auto-apply to Jobs on Dice - Self-Healing", async ({ browser }) => {
  let logger = new JobApplicationLogger();
  await logger.initializeExcel();

  let stats = {
    applied: 0,
    failed: 0,
    skipped: 0,
    alreadyApplied: 0,
    total: 0,
  };

  while (currentSearchIdx < SEARCH_ITEMS.length) {
    let context, page;
    let timedOut = false;
    const startTime = Date.now();

    try {
      context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      });
      page = await context.newPage();

      // Login
      const loginSuccess = await safeGoto(page, LOGIN_URL);
      if (!loginSuccess) throw new Error("Failed to load login page");

      await page.waitForSelector('input[name="email"]', { timeout: 15000 });
      await page.fill('input[name="email"]', USERNAME);
      await safeClick(page, 'button[type="submit"]', "first submit button");
      await page.waitForSelector('input[name="password"]', { timeout: 15000 });
      await page.fill('input[name="password"]', PASSWORD);
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle", timeout: 30000 }),
        safeClick(page, 'button[type="submit"]', "password submit button"),
      ]);
      await page.waitForTimeout(3000);

      // Resume from last progress
      for (; currentSearchIdx < SEARCH_ITEMS.length; currentSearchIdx++) {
        const searchTerm = SEARCH_ITEMS[currentSearchIdx];
        const encodedSearch = encodeURIComponent(searchTerm);

        for (; currentPageNum <= MAX_PAGES; currentPageNum++) {
          // Self-heal if delay crosses 30min
          if (Date.now() - startTime > 1800000) {
            // 30min in ms
            timedOut = true;
            break;
          }

          let url = `https://www.dice.com/jobs?filters.easyApply=true&filters.postedDate=ONE&q=${encodedSearch}`;
          if (currentPageNum > 1) url += `&page=${currentPageNum}`;
          const pageLoaded = await safeGoto(page, url);
          if (!pageLoaded) continue;

          try {
            await page.waitForSelector("[data-testid='job-search-serp-card']", {
              timeout: 15000,
            });
          } catch (err) {
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
          if (jobCards.length === 0) continue;

          const results = await processJobBatch(context, jobCards, logger);

          results.forEach((result) => {
            stats.total++;
            if (result.success) {
              if (result.alreadyApplied) stats.alreadyApplied++;
              else stats.applied++;
            } else if (result.skipped) stats.skipped++;
            else stats.failed++;
          });

          await new Promise((resolve) => setTimeout(resolve, PAGE_DELAY));
        }
        if (timedOut) {
          console.log("⏰ Timed out, stopping further processing.");
          break;
        }
      }
    } catch (error) {
      console.error(`❌ Error in test execution: ${error.message}`);
    } finally {
      // Cleanup: close context if still open
      if (context && !context._closed) {
        try {
          await context.close();
        } catch (closeErr) {
          console.error(`Failed to close context: ${closeErr.message}`);
        }
      }
    }
  }

  // Finalize and save logs
  try {
    await logger.saveExcel();
    await logger.generateHtmlReport();
  } catch (error) {
    console.error(`❌ Error finalizing logs: ${error.message}`);
  }

  // Summary
  console.log("✅ Test completed.");
  console.log(`📁 Excel Log: ${logger.filepath}`);
  console.log(`🌐 HTML Report: ${logger.htmlReportPath}`);
  console.table(stats);
});
