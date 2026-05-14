const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });
const logos = {
  "south-texas-builder": "/assets/south-texas-builders.png",
  cuates: "/assets/cuates-construction.png"
};
const themes = {
  "south-texas-builder": {
    primary: "#142458",
    accent: "#ff342b",
    soft: "#eef2fb",
    dark: "#142458",
    highlight: "#142458"
  },
  cuates: {
    primary: "#111111",
    accent: "#c66b22",
    soft: "#fbf1e8",
    dark: "#111111",
    highlight: "#c66b22"
  }
};

const els = {
  loginScreen: document.querySelector("#login-screen"),
  loginForm: document.querySelector("#login-form"),
  dashboardPassword: document.querySelector("#dashboard-password"),
  loginError: document.querySelector("#login-error"),
  companyNav: document.querySelector("#company-nav"),
  selectedCompany: document.querySelector("#selected-company"),
  selectedSubtitle: document.querySelector("#selected-subtitle"),
  selectedLogo: document.querySelector("#selected-logo"),
  sheetStatus: document.querySelector("#sheet-status"),
  metaStatus: document.querySelector("#meta-status"),
  updatedStatus: document.querySelector("#updated-status"),
  metricGrid: document.querySelector("#metric-grid"),
  funnel: document.querySelector("#funnel"),
  meetingList: document.querySelector("#meeting-list"),
  meetingCount: document.querySelector("#meeting-count"),
  campaignGroups: document.querySelector("#campaign-groups"),
  campaignCount: document.querySelector("#campaign-count"),
  generateSummary: document.querySelector("#generate-summary"),
  summaryStatus: document.querySelector("#summary-status"),
  summaryGrid: document.querySelector("#summary-grid"),
  aiChatForm: document.querySelector("#ai-chat-form"),
  aiQuestion: document.querySelector("#ai-question"),
  askAi: document.querySelector("#ask-ai"),
  aiAnswer: document.querySelector("#ai-answer"),
  reportEnabled: document.querySelector("#report-enabled"),
  reportEmail: document.querySelector("#report-email"),
  saveReportSettings: document.querySelector("#save-report-settings"),
  generateReport: document.querySelector("#generate-report"),
  sendReportNow: document.querySelector("#send-report-now"),
  printReport: document.querySelector("#print-report"),
  reportStatus: document.querySelector("#report-status"),
  reportPreview: document.querySelector("#report-preview"),
  rangeButtons: [...document.querySelectorAll("[data-range]")],
  sinceDate: document.querySelector("#since-date"),
  untilDate: document.querySelector("#until-date"),
  applyRange: document.querySelector("#apply-range")
};

let activeGranularity = "daily";
let activeRange = { since: "2026-03-01", until: "2026-03-31" };
let selectedSourceId = "south-texas-builder";
let lastData = null;
let latestReportHtml = "";

for (const button of els.rangeButtons) {
  button.addEventListener("click", () => {
    if (button.dataset.range === "custom") {
      els.rangeButtons.forEach((item) => item.classList.toggle("active", item === button));
      return;
    }
    activeRange = getPresetRange(button.dataset.range);
    els.sinceDate.value = activeRange.since;
    els.untilDate.value = activeRange.until;
    els.rangeButtons.forEach((item) => item.classList.toggle("active", item === button));
    loadDashboard();
  });
}

els.applyRange.addEventListener("click", () => {
  activeRange = normalizeRange(els.sinceDate.value, els.untilDate.value);
  els.sinceDate.value = activeRange.since;
  els.untilDate.value = activeRange.until;
  els.rangeButtons.forEach((item) => item.classList.remove("active"));
  loadDashboard();
});

els.generateSummary.addEventListener("click", generateExecutiveSummary);
els.aiChatForm.addEventListener("submit", askAiQuestion);
els.saveReportSettings.addEventListener("click", saveReportSettings);
els.generateReport.addEventListener("click", () => generateWeeklyReport(false));
els.sendReportNow.addEventListener("click", () => generateWeeklyReport(true));
els.printReport.addEventListener("click", printReport);
if (new URLSearchParams(window.location.search).get("login") === "failed") {
  els.loginError.textContent = "Incorrect password";
}

startApp();

async function startApp() {
  unlockDashboard();
  loadDashboard();
  loadReportSettings();
}

async function checkSession() {
  try {
    const response = await fetch("/api/session");
    if (!response.ok) return { authenticated: false };
    return response.json();
  } catch {
    return { authenticated: false };
  }
}

function unlockDashboard() {
  document.body.classList.add("is-unlocked");
  els.loginScreen.hidden = true;
}

function lockDashboard() {
  document.body.classList.remove("is-unlocked");
  els.loginScreen.hidden = false;
  els.dashboardPassword.focus();
}

async function loadDashboard() {
  setLoading();
  setControlsDisabled(true);
  const params = new URLSearchParams({
    granularity: activeGranularity,
    since: activeRange.since,
    until: activeRange.until
  });
  try {
    const response = await fetch(`/api/dashboard?${params}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Dashboard failed to load");
    render(data);
  } catch (error) {
    showLoadError(error);
  } finally {
    setControlsDisabled(false);
  }
}

function render(data) {
  lastData = data;
  if (!data.sourceTotals.some((source) => source.id === selectedSourceId)) {
    selectedSourceId = data.sourceTotals[0]?.id || selectedSourceId;
  }

  const selected = data.sourceTotals.find((source) => source.id === selectedSourceId) || data.sourceTotals[0] || data.totals;
  const subtitle = `${formatShortDate(data.range.since)} - ${formatShortDate(data.range.until)}`;

  applyTheme(selected.id);
  els.selectedCompany.textContent = selected.name || "Ad Spend Dashboard";
  els.selectedSubtitle.textContent = `Meta Ads · Google Sheets · ${subtitle}`;
  els.selectedLogo.src = logos[selected.id] || "";
  els.selectedLogo.alt = `${selected.name} logo`;
  els.sheetStatus.textContent = `Sheet: ${data.connection.sheet}`;
  els.metaStatus.textContent = `Meta: ${data.connection.meta === "live" ? "live API" : "demo spend"}`;
  els.updatedStatus.textContent = subtitle;

  renderCompanyNav(data.sourceTotals);
  renderSelectedMetrics(selected);
  renderFunnel(selected);
  renderMeetingList(selected.meetingList || []);
  renderCampaignBreakdown(selected.campaignBreakdown || []);
  resetExecutiveSummary();
}

function applyTheme(sourceId) {
  const theme = themes[sourceId] || themes["south-texas-builder"];
  const root = document.documentElement;
  root.style.setProperty("--brand-primary", theme.primary);
  root.style.setProperty("--brand-accent", theme.accent);
  root.style.setProperty("--brand-soft", theme.soft);
  root.style.setProperty("--brand-dark", theme.dark);
  root.style.setProperty("--brand-highlight", theme.highlight);
}

function renderCompanyNav(rows) {
  els.companyNav.innerHTML = rows
    .map((row) => `
      <button class="${row.id === selectedSourceId ? "active" : ""}" data-source-id="${row.id}">
        <span class="nav-logo"><img alt="" src="${logos[row.id] || ""}" /></span>
        ${row.name}
      </button>
    `)
    .join("");

  for (const button of els.companyNav.querySelectorAll("[data-source-id]")) {
    button.addEventListener("click", () => {
      selectedSourceId = button.dataset.sourceId;
      if (lastData) render(lastData);
    });
  }
}

function renderSelectedMetrics(row) {
  const cards = [
    ["Ad Spend", money.format(row.spend), ""],
    ["Total Leads", number.format(row.leads), ""],
    ["Cost / Lead", money.format(row.costPerLead), ""],
    ["Lender Meetings", number.format(row.lender), ""],
    ["Const. Meetings", number.format(row.meetings), ""],
    ["Cost / Meeting", money.format(row.costPerMeeting), "dark"],
    ["Cost / Lender Meeting", money.format(row.costPerLenderMeeting), "wide"],
    ["Avg Daily Spend", money.format(averageDailySpend(row.spend)), ""],
    ["Closed", number.format(row.closed), ""],
    ["CAC", money.format(row.cac), "dark"]
  ];

  els.metricGrid.innerHTML = cards
    .map(([label, value, tone]) => `
      <article class="metric-card ${tone}">
        <span>${label}</span>
        <strong>${value}</strong>
      </article>
    `)
    .join("");
}

function renderFunnel(totals) {
  const items = [
    ["Leads", totals.leads, "100%"],
    ["Qualified", totals.qualified, `${percent.format(safeDivide(totals.qualified, totals.leads))} of leads`],
    ["Lender Meetings", totals.lender, `${percent.format(safeDivide(totals.lender, totals.leads))} of leads`],
    ["Construction Meetings", totals.meetings, `${percent.format(safeDivide(totals.meetings, totals.leads))} of leads`],
    ["Attended", totals.attended, `${percent.format(safeDivide(totals.attended, totals.leads))} of leads`],
    ["Closed", totals.closed, `${percent.format(safeDivide(totals.closed, totals.meetings))} of construction meetings`]
  ];

  els.funnel.innerHTML = items
    .map(([label, value, detail]) => `
      <div class="funnel-step ${label === "Closed" ? "closed" : ""}">
        <div class="funnel-shape">
          <span>${label}</span>
          <strong>${number.format(value)}</strong>
        </div>
        <small>${detail}</small>
      </div>
    `)
    .join("");
}

function renderMeetingList(rows) {
  const sorted = [...rows].sort((a, b) => a.sortDate.localeCompare(b.sortDate) || a.client.localeCompare(b.client));
  els.meetingCount.textContent = `${number.format(sorted.length)} shown`;

  if (!sorted.length) {
    els.meetingList.innerHTML = `<p class="empty-state">No construction meeting names found for this date range.</p>`;
    return;
  }

  els.meetingList.innerHTML = sorted
    .map((row) => `
      <article class="meeting-row ${row.closed ? "closed" : ""}">
        <div>
          <strong>${escapeHtml(row.client)}</strong>
          <small>${escapeHtml(row.month)} ${escapeHtml(row.type)} meeting</small>
        </div>
        <div class="meeting-meta">
          ${row.closed ? "<b>Closed</b>" : "<span>Not closed</span>"}
        </div>
      </article>
    `)
    .join("");
}

function renderCampaignBreakdown(campaigns) {
  els.campaignCount.textContent = `${number.format(campaigns.length)} campaigns`;

  if (!campaigns.length) {
    els.campaignGroups.innerHTML = `<p class="empty-state">No Meta campaign data found for this date range.</p>`;
    return;
  }

  const groups = ["Conversions", "Funnel", "Clients"].map((group) => ({
    name: group,
    campaigns: campaigns.filter((campaign) => campaign.category === group)
  })).filter((group) => group.campaigns.length);

  els.campaignGroups.innerHTML = groups
    .map((group) => `
      <section class="campaign-group">
        <div class="campaign-group-head">
          <h3>${group.name}</h3>
          <span>${number.format(group.campaigns.length)}</span>
        </div>
        <div class="campaign-list">
          ${group.campaigns.map(renderCampaignCard).join("")}
        </div>
      </section>
    `)
    .join("");
}

function renderCampaignCard(campaign) {
  return `
    <details class="campaign-card">
      <summary>
        <div class="campaign-title">
          <strong>${escapeHtml(campaign.name)}</strong>
          <span>${campaign.leads ? `${number.format(campaign.leads)} Meta leads` : "Meta campaign"}</span>
        </div>
        <div class="campaign-metrics">
          <span><b>${money.format(campaign.spend)}</b><small>Spend</small></span>
          <span><b>${number.format(campaign.reach)}</b><small>Reach</small></span>
          <span><b>${number.format(campaign.impressions)}</b><small>Impressions</small></span>
          <span><b>${percent.format(campaign.ctr)}</b><small>CTR</small></span>
          <span><b>${campaign.leads ? money.format(campaign.costPerLead) : "N/A"}</b><small>CPL</small></span>
        </div>
      </summary>
      <div class="campaign-detail-grid">
        ${campaignStat("Clicks", number.format(campaign.clicks))}
        ${campaignStat("Link Clicks", number.format(campaign.linkClicks))}
        ${campaignStat("CPC", campaign.clicks ? money.format(campaign.cpc) : "N/A")}
        ${campaignStat("CPM", campaign.impressions ? money.format(campaign.cpm) : "N/A")}
        ${campaignStat("Frequency", campaign.frequency ? `${decimal.format(campaign.frequency)}x` : "N/A")}
        ${campaignStat("Conversions", number.format(campaign.conversions))}
        ${campaignStat("ROAS", campaign.roas ? `${decimal.format(campaign.roas)}x` : "N/A")}
      </div>
      ${renderTopAds(campaign.ads || [])}
    </details>
  `;
}

function campaignStat(label, value) {
  return `<div><span>${label}</span><strong>${value}</strong></div>`;
}

function renderTopAds(ads) {
  if (!ads.length) {
    return `<p class="empty-state campaign-empty">No ad-level data found for this campaign.</p>`;
  }

  return `
    <div class="top-ads">
      <div class="top-ads-head">
        <h4>Top Ads</h4>
        <span>Best performers by Meta leads</span>
      </div>
      <div class="top-ad-list">
        ${ads.map(renderTopAd).join("")}
      </div>
    </div>
  `;
}

function renderTopAd(ad) {
  const thumbnail = ad.thumbnailUrl
    ? `<img src="${escapeHtml(ad.thumbnailUrl)}" alt="">`
    : `<div class="ad-thumb-placeholder">Ad</div>`;

  return `
    <article class="top-ad">
      <div class="ad-thumb">${thumbnail}</div>
      <div class="ad-copy">
        <strong>${escapeHtml(ad.name)}</strong>
        <span>${ad.leads ? `${number.format(ad.leads)} Meta leads` : "No Meta leads yet"}</span>
      </div>
      <div class="ad-mini-metrics">
        <span><b>${money.format(ad.spend)}</b><small>Spend</small></span>
        <span><b>${ad.leads ? money.format(ad.costPerLead) : "N/A"}</b><small>CPL</small></span>
        <span><b>${percent.format(ad.ctr)}</b><small>CTR</small></span>
      </div>
    </article>
  `;
}

async function generateExecutiveSummary() {
  if (!lastData) return;

  els.generateSummary.disabled = true;
  els.generateSummary.textContent = "Generating...";
  els.summaryStatus.textContent = "Reading Meta campaigns, top ads, and Google Sheet funnel data...";
  els.summaryGrid.innerHTML = "";

  try {
    const response = await fetch("/api/executive-summary", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sourceId: selectedSourceId,
        since: activeRange.since,
        until: activeRange.until
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Executive summary failed");
    renderExecutiveSummary(data);
  } catch (error) {
    els.summaryStatus.textContent = error.message || "Executive summary failed.";
    els.summaryGrid.innerHTML = "";
  } finally {
    els.generateSummary.disabled = false;
    els.generateSummary.textContent = "Generate Summary";
  }
}

function renderExecutiveSummary(data) {
  const sections = Array.isArray(data.sections) ? data.sections : [];

  if (data.mode === "setup-needed") {
    els.summaryStatus.textContent = "AI is ready, but it needs an OpenAI API key before it can write the summary.";
  } else {
    els.summaryStatus.textContent = `Generated for ${formatShortDate(activeRange.since)} - ${formatShortDate(activeRange.until)}`;
  }

  els.summaryGrid.innerHTML = sections
    .map((section) => `
      <article class="summary-card">
        <span>${escapeHtml(section.title || "Summary")}</span>
        <p>${escapeHtml(section.body || "")}</p>
      </article>
    `)
    .join("");
}

function resetExecutiveSummary() {
  els.summaryStatus.textContent = "Generate a CEO-level readout using the selected company, date range, Meta campaigns, top ads, and Google Sheet funnel data.";
  els.summaryGrid.innerHTML = "";
  els.aiAnswer.textContent = "Ask a question about the selected company and date range.";
}

async function askAiQuestion(event) {
  event.preventDefault();
  if (!lastData) return;

  const question = els.aiQuestion.value.trim();
  if (!question) {
    els.aiAnswer.textContent = "Type a question first.";
    return;
  }

  els.askAi.disabled = true;
  els.aiQuestion.disabled = true;
  els.aiAnswer.textContent = "Thinking through the dashboard data...";

  try {
    const response = await fetch("/api/ask-ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sourceId: selectedSourceId,
        since: activeRange.since,
        until: activeRange.until,
        question
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "AI answer failed");
    els.aiAnswer.textContent = data.answer || "No answer returned.";
  } catch (error) {
    els.aiAnswer.textContent = error.message || "AI answer failed.";
  } finally {
    els.askAi.disabled = false;
    els.aiQuestion.disabled = false;
    els.aiQuestion.focus();
  }
}

async function loadReportSettings() {
  try {
    const response = await fetch("/api/report-settings");
    const settings = await response.json();
    if (!response.ok) throw new Error(settings.error || "Report settings failed");
    els.reportEnabled.checked = Boolean(settings.enabled);
    els.reportEmail.value = settings.toEmail || "";
    els.reportEmail.title = "Separate multiple emails with commas.";
  } catch (error) {
    els.reportStatus.textContent = error.message || "Could not load report settings.";
  }
}

async function saveReportSettings() {
  setReportControlsDisabled(true);
  els.reportStatus.textContent = "Saving report settings...";

  try {
    const response = await fetch("/api/report-settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        enabled: els.reportEnabled.checked,
        toEmail: els.reportEmail.value.trim()
      })
    });
    const settings = await response.json();
    if (!response.ok) throw new Error(settings.error || "Could not save report settings");
    els.reportEnabled.checked = Boolean(settings.enabled);
    els.reportEmail.value = settings.toEmail || "";
    els.reportStatus.textContent = settings.enabled
      ? "Friday email is on. The saved weekly job will send this report when scheduled."
      : "Friday email is off. You can still generate or send a report manually.";
  } catch (error) {
    els.reportStatus.textContent = error.message || "Could not save report settings.";
  } finally {
    setReportControlsDisabled(false);
  }
}

async function generateWeeklyReport(send) {
  setReportControlsDisabled(true);
  els.reportStatus.textContent = send ? "Generating and sending report..." : "Generating report preview...";
  els.reportPreview.innerHTML = "";
  latestReportHtml = "";
  els.printReport.disabled = true;

  try {
    const response = await fetch("/api/weekly-report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        since: activeRange.since,
        until: activeRange.until,
        send,
        toEmail: els.reportEmail.value.trim()
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Report failed");
    const report = result.report || result;
    latestReportHtml = report.html || "";
    els.reportPreview.innerHTML = latestReportHtml;
    els.printReport.disabled = !latestReportHtml;
    els.reportStatus.textContent = send
      ? `Report sent to ${els.reportEmail.value.trim() || "saved email"}.`
      : `Report generated for ${formatShortDate(activeRange.since)} - ${formatShortDate(activeRange.until)}.`;
  } catch (error) {
    els.reportStatus.textContent = error.message || "Report failed.";
  } finally {
    setReportControlsDisabled(false);
  }
}

function printReport() {
  if (!latestReportHtml) return;
  const printWindow = window.open("", "_blank");
  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Weekly Lead Intelligence Report</title>
        <style>
          body { margin: 32px; font-family: Arial, sans-serif; }
          @media print { body { margin: 18px; } }
        </style>
      </head>
      <body>${latestReportHtml}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function setReportControlsDisabled(disabled) {
  for (const control of [els.reportEnabled, els.reportEmail, els.saveReportSettings, els.generateReport, els.sendReportNow]) {
    control.disabled = disabled;
  }
  els.printReport.disabled = disabled || !latestReportHtml;
}

function averageDailySpend(spend) {
  const start = parseDate(activeRange.since);
  const end = parseDate(activeRange.until);
  const days = Math.max(Math.round((end - start) / 86400000) + 1, 1);
  return spend / days;
}

function safeDivide(numerator = 0, denominator = 0) {
  return denominator ? numerator / denominator : 0;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setLoading() {
  els.sheetStatus.textContent = "Sheet: loading";
  els.metaStatus.textContent = "Meta: loading";
  els.updatedStatus.textContent = "Range: loading";
}

function showLoadError(error) {
  const message = String(error?.message || "Dashboard failed to load");
  els.sheetStatus.textContent = "Sheet: check needed";
  els.metaStatus.textContent = message.includes("access token") || message.includes("Meta API")
    ? "Meta: token needs refresh"
    : "Meta: check needed";
  els.updatedStatus.textContent = "Data not updated";
}

function setControlsDisabled(disabled) {
  for (const control of [...els.rangeButtons, els.sinceDate, els.untilDate, els.applyRange, els.generateSummary, els.aiQuestion, els.askAi]) {
    control.disabled = disabled;
  }
}

function getPresetRange(preset) {
  const today = localDate(new Date());
  const date = parseDate(today);

  if (preset === "last-month") {
    const firstOfThisMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const lastOfLastMonth = addDays(firstOfThisMonth, -1);
    return {
      since: `${lastOfLastMonth.getFullYear()}-${String(lastOfLastMonth.getMonth() + 1).padStart(2, "0")}-01`,
      until: localDate(lastOfLastMonth)
    };
  }

  if (preset === "this-month") {
    return { since: `${today.slice(0, 8)}01`, until: today };
  }

  if (preset === "this-year") {
    return { since: `${today.slice(0, 4)}-01-01`, until: today };
  }

  if (preset === "last-year") {
    const year = Number(today.slice(0, 4)) - 1;
    return { since: `${year}-01-01`, until: `${year}-12-31` };
  }

  return { since: "2026-03-01", until: "2026-03-31" };
}

function normalizeRange(since, until) {
  if (!since || !until) return activeRange;
  return since <= until ? { since, until } : { since: until, until: since };
}

function parseDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function localDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatShortDate(dateString) {
  return parseDate(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
