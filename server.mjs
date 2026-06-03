import http from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");

loadDotEnv();

const config = {
  host: process.env.HOST || "0.0.0.0",
  port: Number(process.env.PORT || 4173),
  sheetId: process.env.GOOGLE_SHEET_ID || "1rjmXjtyBTmch7SJY58cA8ZGKYWlwPxEe0WOd2Ce9i2Q",
  sheetGid: process.env.GOOGLE_SHEET_GID || "1610026683",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  supabaseStartDate: process.env.SUPABASE_START_DATE || "2026-06-01",
  googleOAuthClientFile: process.env.GOOGLE_OAUTH_CLIENT_FILE || "",
  googleOAuthTokenFile: process.env.GOOGLE_OAUTH_TOKEN_FILE || path.join(__dirname, ".google-sheets-token.json"),
  googleOAuthClientJson: process.env.GOOGLE_OAUTH_CLIENT_JSON || "",
  googleOAuthTokenJson: process.env.GOOGLE_OAUTH_TOKEN_JSON || "",
  googleOAuthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || "",
  googleOAuthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || "",
  googleOAuthRefreshToken: process.env.GOOGLE_OAUTH_REFRESH_TOKEN || "",
  metaToken: process.env.META_ACCESS_TOKEN || "",
  metaTokens: {
    "south-texas-builder": process.env.SOUTH_TEXAS_META_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || "",
    cuates: process.env.CUATES_META_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || ""
  },
  metaAccounts: {
    "south-texas-builder": process.env.SOUTH_TEXAS_META_AD_ACCOUNT_ID || process.env.META_AD_ACCOUNT_ID || "",
    cuates: process.env.CUATES_META_AD_ACCOUNT_ID || ""
  },
  metaSince: process.env.META_SINCE || "2026-03-01",
  metaUntil: process.env.META_UNTIL || "2026-03-31",
  sheetTabs: parseSheetTabs(process.env.SHEET_TABS),
  metaVersion: process.env.META_API_VERSION || "v25.0",
  openAiKey: process.env.OPENAI_API_KEY || "",
  openAiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  resendApiKey: process.env.RESEND_API_KEY || "",
  reportFromEmail: process.env.REPORT_FROM_EMAIL || "Lead Intelligence <onboarding@resend.dev>",
  reportToEmail: process.env.REPORT_TO_EMAIL || "",
  reportSettingsFile: process.env.REPORT_SETTINGS_FILE || path.join(__dirname, ".weekly-report-settings.json"),
  dashboardPassword: "",
  sessionCookie: process.env.DASHBOARD_SESSION_COOKIE || "lead_intelligence_session"
};

const sourceDefinitions = [
  {
    id: "south-texas-builder",
    name: "South Texas Builders",
    campaignMatch: ["south texas builder", "south texas builders", "stb"],
    columns: {
      leads: 1,
      noAnswer: 2,
      notQualified: 3,
      qualified: 4,
      lender: 5,
      meetings: 6,
      noShows: 7,
      attended: 8,
      closed: 9
    },
    meetingList: {
      number: 1,
      name: 2,
      date: 4,
      status: 5
    }
  },
  {
    id: "cuates",
    name: "Cuates Construction",
    campaignMatch: ["cuates", "cuates construction"],
    columns: {
      leads: 19,
      noAnswer: 20,
      notQualified: 21,
      qualified: 22,
      lender: 23,
      meetings: 24,
      noShows: 25,
      attended: 26,
      closed: 27
    },
    meetingList: {
      number: 21,
      name: 22,
      date: 24,
      status: 25
    }
  }
];

const metricLabels = {
  leads: "Leads",
  qualified: "Qualified",
  meetings: "Meetings",
  attended: "Attended",
  closed: "Closed",
  noShows: "No-shows"
};

const demoSpend = [
  { sourceId: "south-texas-builder", date: "2026-03-01", campaign: "South Texas Builders Demo", spend: 182.41, reach: 5400, impressions: 6120, clicks: 92, leads: 8 },
  { sourceId: "south-texas-builder", date: "2026-03-02", campaign: "South Texas Builders Demo", spend: 201.88, reach: 5980, impressions: 6750, clicks: 106, leads: 10 },
  { sourceId: "south-texas-builder", date: "2026-03-03", campaign: "South Texas Builders Demo", spend: 194.65, reach: 5700, impressions: 6422, clicks: 101, leads: 8 },
  { sourceId: "south-texas-builder", date: "2026-03-04", campaign: "South Texas Builders Demo", spend: 220.74, reach: 6210, impressions: 7114, clicks: 115, leads: 11 },
  { sourceId: "south-texas-builder", date: "2026-03-05", campaign: "South Texas Builders Demo", spend: 211.3, reach: 6020, impressions: 6992, clicks: 111, leads: 9 },
  { sourceId: "cuates", date: "2026-03-01", campaign: "Cuates Construction Demo", spend: 154.72, reach: 4610, impressions: 5212, clicks: 80, leads: 7 },
  { sourceId: "cuates", date: "2026-03-02", campaign: "Cuates Construction Demo", spend: 166.1, reach: 4880, impressions: 5440, clicks: 84, leads: 7 },
  { sourceId: "cuates", date: "2026-03-03", campaign: "Cuates Construction Demo", spend: 160.25, reach: 4710, impressions: 5318, clicks: 82, leads: 6 },
  { sourceId: "cuates", date: "2026-03-04", campaign: "Cuates Construction Demo", spend: 171.92, reach: 4990, impressions: 5691, clicks: 90, leads: 8 },
  { sourceId: "cuates", date: "2026-03-05", campaign: "Cuates Construction Demo", spend: 158.37, reach: 4670, impressions: 5260, clicks: 79, leads: 6 }
];

const cache = new Map();
const cacheTtlMs = Number(process.env.CACHE_TTL_SECONDS || 900) * 1000;

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/api/login") {
      if (req.method !== "POST") return sendJson(res, { error: "Method not allowed" }, 405);
      const { body, wantsHtml } = await readLoginBody(req);
      if (!config.dashboardPassword || String(body.password || "").trim() === config.dashboardPassword) {
        const headers = {
          "content-type": "application/json",
          "set-cookie": `${config.sessionCookie}=1; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`
        };
        if (wantsHtml) {
          res.writeHead(303, {
            ...headers,
            location: "/"
          });
          return res.end();
        }
        res.writeHead(200, headers);
        return res.end(JSON.stringify({ ok: true }));
      }
      if (wantsHtml) {
        res.writeHead(303, { location: "/?login=failed" });
        return res.end();
      }
      return sendJson(res, { error: "Incorrect password" }, 401);
    }

    if (url.pathname === "/api/logout") {
      res.writeHead(200, {
        "content-type": "application/json",
        "set-cookie": `${config.sessionCookie}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
      });
      return res.end(JSON.stringify({ ok: true }));
    }

    if (url.pathname === "/api/session") {
      return sendJson(res, {
        authenticated: isAuthenticated(req),
        passwordEnabled: Boolean(config.dashboardPassword)
      });
    }

    if (isProtectedRequest(url.pathname) && !isAuthenticated(req)) {
      return sendJson(res, { error: "Password required" }, 401);
    }

    if (url.pathname === "/api/dashboard") {
      const granularity = url.searchParams.get("granularity") || "daily";
      const range = normalizeRange(url.searchParams.get("since"), url.searchParams.get("until"));
      const data = await getDashboardData(granularity, range);
      return sendJson(res, data);
    }

    if (url.pathname === "/api/campaign-insights") {
      const range = normalizeRange(url.searchParams.get("since"), url.searchParams.get("until"));
      const sourceId = url.searchParams.get("sourceId") || sourceDefinitions[0].id;
      const meta = await fetchMetaSpend(range, { includeCreatives: true });
      const source = sourceDefinitions.find((item) => item.id === sourceId) || sourceDefinitions[0];
      const rows = meta.rows.filter((row) => belongsToSource(row, source));
      return sendJson(res, {
        updatedAt: new Date().toISOString(),
        range,
        sourceId: source.id,
        sourceName: source.name,
        mode: meta.live ? "live" : "demo",
        campaigns: buildCampaignBreakdown(rows)
      });
    }

    if (url.pathname === "/api/executive-summary") {
      if (req.method !== "POST") return sendJson(res, { error: "Method not allowed" }, 405);
      const body = await readJsonBody(req);
      const range = normalizeRange(body.since, body.until);
      const data = await getDashboardData("daily", range, { includeCampaigns: true, includeCreatives: true });
      const source = data.sourceTotals.find((item) => item.id === body.sourceId) || data.sourceTotals[0];
      const summary = await generateExecutiveSummary(source, data.range);
      return sendJson(res, summary);
    }

    if (url.pathname === "/api/action-plan") {
      if (req.method !== "POST") return sendJson(res, { error: "Method not allowed" }, 405);
      const body = await readJsonBody(req);
      const range = normalizeRange(body.since, body.until);
      const data = await getDashboardData("daily", range, { includeCampaigns: true, includeCreatives: true });
      const source = data.sourceTotals.find((item) => item.id === body.sourceId) || data.sourceTotals[0];
      const actionPlan = await generateActionPlan(source, data.range);
      return sendJson(res, actionPlan);
    }

    if (url.pathname === "/api/ask-ai") {
      if (req.method !== "POST") return sendJson(res, { error: "Method not allowed" }, 405);
      const body = await readJsonBody(req);
      const range = normalizeRange(body.since, body.until);
      const data = await getDashboardData("daily", range, { includeCampaigns: true, includeCreatives: true });
      const source = data.sourceTotals.find((item) => item.id === body.sourceId) || data.sourceTotals[0];
      const answer = await answerDashboardQuestion(source, data.range, body.question);
      return sendJson(res, answer);
    }

    if (url.pathname === "/api/weekly-report") {
      if (req.method !== "POST") return sendJson(res, { error: "Method not allowed" }, 405);
      const body = await readJsonBody(req);
      const range = body.since && body.until ? normalizeRange(body.since, body.until) : previousWeekRange();
      const report = await createWeeklyReport(range);
      if (body.send) {
        const email = await sendWeeklyReportEmail(report, body.toEmail);
        return sendJson(res, { sent: true, email, report });
      }
      return sendJson(res, report);
    }

    if (url.pathname === "/api/report-settings") {
      if (req.method === "GET") return sendJson(res, await getReportSettings());
      if (req.method === "POST") {
        const body = await readJsonBody(req);
        const settings = await saveReportSettings({
          enabled: Boolean(body.enabled),
          toEmail: String(body.toEmail || "").trim()
        });
        return sendJson(res, settings);
      }
      return sendJson(res, { error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/config") {
      return sendJson(res, {
        sheetConnected: Boolean(config.sheetId && config.sheetGid),
        metaConnected: Object.entries(config.metaAccounts).some(([sourceId, accountId]) => accountId && config.metaTokens[sourceId]),
        metaVersion: config.metaVersion
      });
    }

    await serveStatic(url.pathname, res);
  } catch (error) {
    console.error(error);
    sendJson(res, { error: error.message || "Something went wrong" }, 500);
  }
});

if (isMainModule()) {
  server.listen(config.port, config.host, () => {
    console.log(`Dashboard running at http://localhost:${config.port}`);
  });
}

async function getDashboardData(granularity, range, options = {}) {
  const [leadData, meta] = await Promise.all([
    fetchLeadData(range),
    fetchMetaSpend(range, {
      includeCampaigns: Boolean(options.includeCampaigns),
      includeCreatives: Boolean(options.includeCreatives)
    })
  ]);
  const sourceTotals = buildSourceTotals(leadData.dailyRows, meta.rows, leadData.meetingRows, {
    includeCampaigns: Boolean(options.includeCampaigns)
  });
  const timeline = buildTimeline(leadData.dailyRows, meta.rows, granularity);
  const totals = sumTotals(sourceTotals);

  return {
    updatedAt: new Date().toISOString(),
    granularity,
    range,
    mode: meta.live ? "live" : "demo",
    connection: {
      sheet: leadData.connection,
      meta: meta.live ? "live" : "demo"
    },
    totals,
    sourceTotals,
    timeline,
    metricLabels
  };
}

async function generateActionPlan(source, range) {
  const payload = buildSummaryPayload(source, range);

  if (!config.openAiKey) {
    return fallbackActionPlan(payload);
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.openAiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: config.openAiModel,
      temperature: 0.1,
      input: [
        {
          role: "system",
          content: "You are a practical marketing operator advising a CEO. Use only the provided dashboard data. Do not invent revenue, causes, or attribution. Be brief."
        },
        {
          role: "user",
          content: `Return only valid JSON with this exact shape: {"scale":"one short sentence","watch":"one short sentence","fix":"one short sentence"}. Recommend what to scale, what to watch, and what to fix based only on this data.\n\nDashboard data:\n${JSON.stringify(payload)}`
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`AI action plan failed: ${response.status} ${await response.text()}`);
  }

  const result = await response.json();
  const text = result.output_text || result.output?.flatMap((item) => item.content || []).map((item) => item.text || "").join("\n") || "";
  return parseActionPlanJson(text, payload);
}

function fallbackActionPlan(payload) {
  const campaigns = payload.topCampaigns || [];
  const best = [...campaigns].sort((a, b) => {
    if ((b.leads || 0) !== (a.leads || 0)) return (b.leads || 0) - (a.leads || 0);
    return (a.cpl || 999999) - (b.cpl || 999999);
  })[0];
  const weak = [...campaigns].sort((a, b) => {
    const aScore = a.leads ? a.cpl : (a.spend || 0) * 2;
    const bScore = b.leads ? b.cpl : (b.spend || 0) * 2;
    return bScore - aScore;
  })[0];

  return {
    scale: best ? `Scale ${best.name} if budget is available; it has the strongest lead signal in this range.` : "Scale is not clear yet because campaign lead data is limited.",
    watch: `Watch cost per meeting at ${formatMoneyText(payload.kpis.costPerMeeting)} and construction meetings at ${payload.kpis.constructionMeetings}.`,
    fix: weak ? `Fix or review ${weak.name}; it has the weakest spend-to-lead signal in this range.` : "Fix is not clear yet because weak campaign data is limited.",
    mode: "fallback"
  };
}

function parseActionPlanJson(text, payload) {
  try {
    const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      scale: String(parsed.scale || "").trim() || fallbackActionPlan(payload).scale,
      watch: String(parsed.watch || "").trim() || fallbackActionPlan(payload).watch,
      fix: String(parsed.fix || "").trim() || fallbackActionPlan(payload).fix,
      mode: "ai",
      model: config.openAiModel,
      generatedAt: new Date().toISOString()
    };
  } catch {
    return fallbackActionPlan(payload);
  }
}

async function generateExecutiveSummary(source, range) {
  if (!config.openAiKey) {
    return {
      mode: "setup-needed",
      sections: [
        {
          title: "AI setup needed",
          body: "Add an OpenAI API key to the dashboard settings file to generate the executive summary."
        }
      ]
    };
  }

  const payload = buildSummaryPayload(source, range);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.openAiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: config.openAiModel,
      temperature: 0.2,
      input: [
        {
          role: "system",
          content: "You are an elite marketing executive and growth strategist. Be concise, direct, and practical. Use only the provided dashboard data. If revenue/ROAS data is missing, say it is not available instead of inventing it."
        },
        {
          role: "user",
          content: `Create an executive marketing summary for this construction lead dashboard. Return only valid JSON with this shape: {"sections":[{"title":"Overall Read","body":"..."},{"title":"What Is Working","body":"..."},{"title":"What Needs Attention","body":"..."},{"title":"Funnel Bottleneck","body":"..."},{"title":"Recommended Next Moves","body":"..."}]}. Keep each body 1-2 sentences, CEO-level, simple, and actionable.\n\nDashboard data:\n${JSON.stringify(payload)}`
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI summary failed: ${response.status} ${await response.text()}`);
  }

  const result = await response.json();
  const text = result.output_text || result.output?.flatMap((item) => item.content || []).map((item) => item.text || "").join("\n") || "";
  const parsed = parseSummaryJson(text);

  return {
    mode: "ai",
    model: config.openAiModel,
    generatedAt: new Date().toISOString(),
    ...parsed
  };
}

async function answerDashboardQuestion(source, range, question) {
  const cleanQuestion = String(question || "").trim();
  if (!cleanQuestion) {
    return { answer: "Ask a question about the selected company, date range, campaigns, ads, or funnel." };
  }

  if (!config.openAiKey) {
    return { answer: "AI is ready, but it needs an OpenAI API key before it can answer questions." };
  }

  const payload = buildSummaryPayload(source, range);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.openAiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: config.openAiModel,
      temperature: 0.15,
      input: [
        {
          role: "system",
          content: "You are a top marketing and sales executive advising the CEO. Answer only from the provided dashboard data. Do not use outside knowledge. Do not invent causes, revenue, profit, attribution, or facts. If the data does not prove something, say that clearly. Be concise, strategic, and actionable."
        },
        {
          role: "user",
          content: `Question: ${cleanQuestion}\n\nDashboard data:\n${JSON.stringify(payload)}\n\nAnswer in 2-5 short sentences. Use plain business language. If helpful, include one recommended next action.`
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`AI chat failed: ${response.status} ${await response.text()}`);
  }

  const result = await response.json();
  const text = result.output_text || result.output?.flatMap((item) => item.content || []).map((item) => item.text || "").join("\n") || "";
  return {
    answer: text.trim() || "The AI did not return an answer. Try asking again.",
    model: config.openAiModel,
    generatedAt: new Date().toISOString()
  };
}

export async function createWeeklyReport(range = previousWeekRange()) {
  const data = await getDashboardData("daily", range, { includeCampaigns: true, includeCreatives: true });
  const sources = data.sourceTotals.map((source) => {
    const topCampaign = bestByLeads(source.campaignBreakdown || []);
    const topAd = bestByLeads((source.campaignBreakdown || []).flatMap((campaign) => campaign.ads || []));

    return {
      id: source.id,
      name: source.name,
      spend: roundMoney(source.spend),
      leads: source.leads,
      costPerLead: roundMoney(source.costPerLead),
      lenderMeetings: source.lender,
      constructionMeetings: source.meetings,
      closed: source.closed,
      cac: source.closed ? roundMoney(source.cac) : null,
      closeRate: roundRate(safeDivide(source.closed, source.meetings)),
      topCampaign: topCampaign ? {
        name: topCampaign.name,
        leads: topCampaign.leads,
        spend: roundMoney(topCampaign.spend),
        cpl: roundMoney(topCampaign.costPerLead),
        ctr: roundRate(topCampaign.ctr)
      } : null,
      topAd: topAd ? {
        name: topAd.name,
        leads: topAd.leads,
        spend: roundMoney(topAd.spend),
        cpl: roundMoney(topAd.costPerLead),
        ctr: roundRate(topAd.ctr)
      } : null
    };
  });

  const executiveSummary = await generateWeeklyExecutiveReadout({ range, sources });

  return {
    generatedAt: new Date().toISOString(),
    range,
    subject: `Weekly Lead Intelligence Report - ${formatReportDate(range.since)} to ${formatReportDate(range.until)}`,
    sources,
    executiveSummary,
    text: buildWeeklyReportText(range, sources, executiveSummary),
    html: buildWeeklyReportHtml(range, sources, executiveSummary)
  };
}

async function generateWeeklyExecutiveReadout(payload) {
  if (!config.openAiKey) {
    return [
      "AI summary was not generated because OPENAI_API_KEY is not configured.",
      "The KPI tables below still show the live Meta and Google Sheets performance data."
    ];
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.openAiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: config.openAiModel,
      temperature: 0.2,
      input: [
        {
          role: "system",
          content: "You are a top marketing and sales executive reporting to the CEO. Use only the provided weekly dashboard data. Do not invent causes, revenue, profit, or attribution. Be concise and actionable."
        },
        {
          role: "user",
          content: `Write a weekly CEO report summary using only this data. Return valid JSON like {"bullets":["...","...","..."]}. Include what worked, what needs attention, and one next move.\n\nData:\n${JSON.stringify(payload)}`
        }
      ]
    })
  });

  if (!response.ok) {
    return [`AI summary could not be generated: ${response.status}. The KPI tables below still show live dashboard data.`];
  }

  const result = await response.json();
  const text = result.output_text || result.output?.flatMap((item) => item.content || []).map((item) => item.text || "").join("\n") || "";
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed.bullets) && parsed.bullets.length) {
      return parsed.bullets.map((bullet) => String(bullet));
    }
  } catch {
    // Fall through to text fallback.
  }
  return text.trim() ? [text.trim()] : ["AI summary could not be generated clearly. The KPI tables below still show live dashboard data."];
}

export async function sendWeeklyReportEmail(report, toEmail) {
  if (!config.resendApiKey) {
    throw new Error("RESEND_API_KEY is missing. Add your Resend API key to .env first.");
  }
  const recipients = parseEmailList(toEmail || (await getReportSettings()).toEmail || config.reportToEmail || "");
  if (!recipients.length) {
    throw new Error("REPORT_TO_EMAIL is missing. Add the destination email to .env first.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.resendApiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from: config.reportFromEmail,
      to: recipients,
      subject: report.subject,
      text: report.text,
      html: report.html
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Resend email failed: ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload;
}

export async function getReportSettings() {
  try {
    const settings = JSON.parse(await readFile(config.reportSettingsFile, "utf8"));
    return {
      enabled: Boolean(settings.enabled),
      toEmail: parseEmailList(settings.toEmail || config.reportToEmail || "").join(", ")
    };
  } catch {
    return {
      enabled: false,
      toEmail: parseEmailList(config.reportToEmail || "").join(", ")
    };
  }
}

async function saveReportSettings(settings) {
  const saved = {
    enabled: Boolean(settings.enabled),
    toEmail: parseEmailList(settings.toEmail || "").join(", ")
  };
  await writeFile(config.reportSettingsFile, `${JSON.stringify(saved, null, 2)}\n`);
  return saved;
}

function buildWeeklyReportText(range, sources, executiveSummary) {
  const lines = [
    "Weekly Lead Intelligence Report",
    `${formatReportDate(range.since)} - ${formatReportDate(range.until)}`,
    "",
    "CEO Summary",
    ...executiveSummary.map((item) => `- ${item}`),
    ""
  ];

  for (const source of sources) {
    lines.push(
      source.name,
      `Ad Spend: ${formatMoneyText(source.spend)}`,
      `Leads: ${source.leads}`,
      `Cost Per Lead: ${formatMoneyText(source.costPerLead)}`,
      `Construction Meetings: ${source.constructionMeetings}`,
      `Lender Meetings: ${source.lenderMeetings}`,
      `Closed: ${source.closed}`,
      `CAC: ${formatMoneyOrNA(source.cac)}`,
      `Best Campaign: ${source.topCampaign ? `${source.topCampaign.name} (${source.topCampaign.leads} leads, ${formatMoneyText(source.topCampaign.cpl)} CPL)` : "N/A"}`,
      `Best Ad: ${source.topAd ? `${source.topAd.name} (${source.topAd.leads} leads, ${formatMoneyText(source.topAd.cpl)} CPL)` : "N/A"}`,
      ""
    );
  }

  return lines.join("\n");
}

function buildWeeklyReportHtml(range, sources, executiveSummary) {
  return `
    <div style="font-family: Arial, sans-serif; color: #14202b; line-height: 1.45;">
      <h1 style="margin: 0 0 4px;">Weekly Lead Intelligence Report</h1>
      <p style="margin: 0 0 18px; color: #667085;">${formatReportDate(range.since)} - ${formatReportDate(range.until)}</p>
      <h2 style="font-size: 18px;">CEO Summary</h2>
      <ul>${executiveSummary.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      ${sources.map((source) => `
        <h2 style="font-size: 18px; margin-top: 24px;">${escapeHtml(source.name)}</h2>
        <table style="border-collapse: collapse; width: 100%; max-width: 760px;">
          ${reportRow("Ad Spend", formatMoneyText(source.spend))}
          ${reportRow("Leads", source.leads)}
          ${reportRow("Cost Per Lead", formatMoneyText(source.costPerLead))}
          ${reportRow("Construction Meetings", source.constructionMeetings)}
          ${reportRow("Lender Meetings", source.lenderMeetings)}
          ${reportRow("Closed", source.closed)}
          ${reportRow("CAC", formatMoneyOrNA(source.cac))}
          ${reportRow("Best Campaign", source.topCampaign ? `${escapeHtml(source.topCampaign.name)} (${source.topCampaign.leads} leads, ${formatMoneyText(source.topCampaign.cpl)} CPL)` : "N/A")}
          ${reportRow("Best Ad", source.topAd ? `${escapeHtml(source.topAd.name)} (${source.topAd.leads} leads, ${formatMoneyText(source.topAd.cpl)} CPL)` : "N/A")}
        </table>
      `).join("")}
    </div>
  `;
}

function reportRow(label, value) {
  return `
    <tr>
      <td style="border: 1px solid #d8e0df; padding: 9px 10px; background: #f6f8f8; font-weight: 700;">${escapeHtml(label)}</td>
      <td style="border: 1px solid #d8e0df; padding: 9px 10px;">${value}</td>
    </tr>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildSummaryPayload(source, range) {
  const topCampaigns = [...(source.campaignBreakdown || [])]
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 8)
    .map((campaign) => ({
      name: campaign.name,
      category: campaign.category,
      spend: roundMoney(campaign.spend),
      leads: campaign.leads,
      cpl: roundMoney(campaign.costPerLead),
      ctr: roundRate(campaign.ctr),
      clicks: campaign.clicks,
      conversions: campaign.conversions,
      roas: roundRate(campaign.roas),
      topAds: (campaign.ads || []).slice(0, 3).map((ad) => ({
        name: ad.name,
        spend: roundMoney(ad.spend),
        leads: ad.leads,
        cpl: roundMoney(ad.costPerLead),
        ctr: roundRate(ad.ctr)
      }))
    }));

  return {
    company: source.name,
    range,
    kpis: {
      spend: roundMoney(source.spend),
      sheetLeads: source.leads,
      metaLeads: source.campaignBreakdown?.reduce((sum, campaign) => sum + (campaign.leads || 0), 0) || 0,
      costPerLead: roundMoney(source.costPerLead),
      lenderMeetings: source.lender,
      constructionMeetings: source.meetings,
      attended: source.attended,
      closed: source.closed,
      costPerMeeting: roundMoney(source.costPerMeeting),
      costPerLenderMeeting: roundMoney(source.costPerLenderMeeting),
      cac: roundMoney(source.cac),
      closeRateFromConstructionMeetings: roundRate(safeDivide(source.closed, source.meetings))
    },
    funnel: {
      qualifiedRate: roundRate(safeDivide(source.qualified, source.leads)),
      lenderMeetingRate: roundRate(safeDivide(source.lender, source.leads)),
      constructionMeetingRate: roundRate(safeDivide(source.meetings, source.leads)),
      attendedRate: roundRate(safeDivide(source.attended, source.leads)),
      closeRateFromConstructionMeetings: roundRate(safeDivide(source.closed, source.meetings))
    },
    topCampaigns
  };
}

function parseSummaryJson(text) {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed.sections)) return parsed;
  } catch {
    // Fall through to a simple plain-text fallback.
  }

  return {
    sections: [
      {
        title: "Executive Summary",
        body: text.trim() || "The summary could not be generated clearly. Try again."
      }
    ]
  };
}

async function fetchSheetDailyRows(range) {
  const sheet = await fetchSheetData(range);
  return sheet.dailyRows;
}

async function fetchLeadData(range) {
  const ranges = splitLeadDataRange(range);
  const parts = await Promise.all([
    ranges.sheet ? fetchSheetData(ranges.sheet) : null,
    ranges.supabase ? fetchSupabaseLeadData(ranges.supabase) : null
  ]);
  const activeParts = parts.filter(Boolean);

  return {
    dailyRows: activeParts.flatMap((part) => part.dailyRows),
    meetingRows: activeParts.flatMap((part) => part.meetingRows),
    connection: activeParts.map((part) => part.connection).join(" + ") || "none"
  };
}

function splitLeadDataRange(range) {
  const cutoff = config.supabaseStartDate;
  const result = { sheet: null, supabase: null };

  if (range.since < cutoff) {
    result.sheet = {
      since: range.since,
      until: range.until < cutoff ? range.until : previousDate(cutoff)
    };
  }

  if (range.until >= cutoff) {
    result.supabase = {
      since: range.since > cutoff ? range.since : cutoff,
      until: range.until
    };
  }

  return result;
}

async function fetchSheetData(range) {
  const matchingTabs = config.sheetTabs.filter((tab) => monthOverlapsRange(tab, range));
  const tabData = await Promise.all(matchingTabs.map(async (tab) => {
    const rows = await cached(`sheet:${tab.gid}`, () => fetchSheetRows(tab.gid));
    const monthlyTotalRows = parseMonthlyTotalRows(rows, tab);
    const dailyRows = parseSheetRows(rows, tab).filter((row) => isWithinRange(row.date, range));
    return {
      dailyRows: shouldUseMonthlyTotal(tab, range) && monthlyTotalRows.length ? monthlyTotalRows : dailyRows,
      meetingRows: parseMeetingRows(rows, tab)
    };
  }));

  return {
    dailyRows: tabData.flatMap((tab) => tab.dailyRows),
    meetingRows: tabData.flatMap((tab) => tab.meetingRows),
    connection: "Google Sheets"
  };
}

async function fetchSheetRows(gid) {
  if (hasGoogleOAuthConfig()) {
    try {
      return await fetchSheetRowsWithGoogleApi(gid);
    } catch (error) {
      console.warn(`Google Sheets API read failed for ${gid}; falling back to public CSV. ${error.message}`);
    }
  }

  const csvUrl = `https://docs.google.com/spreadsheets/d/${config.sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
  const response = await fetch(csvUrl);
  if (!response.ok) {
    throw new Error(`Google Sheet tab ${gid} could not be read: ${response.status}`);
  }
  return parseCsv(await response.text());
}

async function fetchSupabaseLeadData(range) {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error("Supabase is required for lead data from June 2026 forward. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  const [companies, dailyEntries, meetings] = await Promise.all([
    supabaseSelect("companies", "id,slug,name,active", { active: "eq.true" }),
    supabaseSelect("daily_entries", "*", {
      entry_date: [`gte.${range.since}`, `lte.${range.until}`]
    }),
    supabaseSelect("meetings", "*", {
      meeting_date: [`gte.${range.since}`, `lte.${range.until}`]
    })
  ]);

  const companyIdToSourceId = new Map(
    companies
      .map((company) => [company.id, sourceIdFromSupabaseSlug(company.slug)])
      .filter(([, sourceId]) => Boolean(sourceId))
  );

  return {
    dailyRows: buildSupabaseDailyRows(dailyEntries, meetings, companyIdToSourceId),
    meetingRows: buildSupabaseMeetingRows(meetings, companyIdToSourceId),
    connection: "Supabase"
  };
}

async function supabaseSelect(table, columns, filters = {}) {
  const url = new URL(`${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/${table}`);
  url.searchParams.set("select", columns);

  for (const [column, value] of Object.entries(filters)) {
    const values = Array.isArray(value) ? value : [value];
    for (const filter of values) {
      url.searchParams.append(column, filter);
    }
  }

  const response = await fetch(url, {
    headers: {
      apikey: config.supabaseServiceRoleKey,
      authorization: `Bearer ${config.supabaseServiceRoleKey}`
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase ${table} read failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

function buildSupabaseDailyRows(entries, meetings, companyIdToSourceId) {
  const rowsByDate = new Map();

  for (const entry of entries) {
    const sourceId = companyIdToSourceId.get(entry.company_id);
    if (!sourceId || !isDateString(entry.entry_date)) continue;

    const row = ensureSupabaseDailyRow(rowsByDate, entry.entry_date);

    row.sources[sourceId] = {
      ...row.sources[sourceId],
      leads: toNumber(entry.leads),
      noAnswer: toNumber(entry.no_answer),
      notQualified: toNumber(entry.not_qualified),
      qualified: toNumber(entry.qualified_leads)
    };

    rowsByDate.set(entry.entry_date, row);
  }

  for (const meeting of meetings) {
    const sourceId = companyIdToSourceId.get(meeting.company_id);
    if (!sourceId || !isDateString(meeting.meeting_date)) continue;

    const row = ensureSupabaseDailyRow(rowsByDate, meeting.meeting_date);
    const source = row.sources[sourceId];
    const type = normalizeSupabaseMeetingType(meeting.meeting_type);
    const status = normalizeSupabaseMeetingStatus(meeting.status);

    if (type === "Lender") source.lender += 1;
    if (type === "Construction") source.meetings += 1;
    if (status === "no-show") source.noShows += 1;
    if (status === "attended") source.attended += 1;
    if (status === "closed") source.closed += 1;

    rowsByDate.set(meeting.meeting_date, row);
  }

  return [...rowsByDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function ensureSupabaseDailyRow(rowsByDate, date) {
  return rowsByDate.get(date) || {
    date,
    day: Number(date.slice(8, 10)),
    sources: blankSourceMetrics()
  };
}

function buildSupabaseMeetingRows(meetings, companyIdToSourceId) {
  return meetings
    .map((meeting) => {
      const sourceId = companyIdToSourceId.get(meeting.company_id);
      const date = meeting.meeting_date;
      if (!sourceId || !isDateString(date)) return null;

      const status = normalizeSupabaseMeetingStatus(meeting.status);
      const type = normalizeSupabaseMeetingType(meeting.meeting_type);
      return {
        sourceId,
        month: date.slice(0, 7),
        sortDate: date,
        date,
        dateKnown: true,
        weekOfMonth: weekOfMonth(date),
        client: cleanText(meeting.client_name),
        type,
        status,
        statusLabel: status === "closed" ? "Closed" : status === "attended" ? "Attended" : "",
        closed: status === "closed"
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.sortDate.localeCompare(b.sortDate) || a.client.localeCompare(b.client));
}

function blankSourceMetrics() {
  return Object.fromEntries(sourceDefinitions.map((source) => [source.id, emptyMetrics()]));
}

function sourceIdFromSupabaseSlug(slug) {
  if (slug === "south") return "south-texas-builder";
  if (slug === "cuates") return "cuates";
  return "";
}

function normalizeSupabaseMeetingType(type) {
  return type === "lender" ? "Lender" : "Construction";
}

function normalizeSupabaseMeetingStatus(status) {
  if (status === "cerrado") return "closed";
  if (status === "atendida") return "attended";
  if (status === "no_show") return "no-show";
  return status || "unknown";
}

async function fetchSheetRowsWithGoogleApi(gid) {
  const accessToken = await getGoogleAccessToken();
  const title = await getSheetTitleByGid(gid, accessToken);
  const range = `'${title.replace(/'/g, "''")}'!A:AZ`;
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}/values/${encodeURIComponent(range)}`);
  url.searchParams.set("valueRenderOption", "FORMATTED_VALUE");
  url.searchParams.set("dateTimeRenderOption", "FORMATTED_STRING");

  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(`values.get failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  return payload.values || [];
}

async function getSheetTitleByGid(gid, accessToken) {
  const metadata = await cached("google-sheet-metadata", async () => {
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}?fields=sheets.properties`, {
      headers: { authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      throw new Error(`spreadsheets.get failed: ${response.status} ${await response.text()}`);
    }

    return response.json();
  });

  const sheet = metadata.sheets?.find((item) => String(item.properties?.sheetId) === String(gid));
  if (!sheet?.properties?.title) {
    throw new Error(`No sheet title found for gid ${gid}`);
  }

  return sheet.properties.title;
}

async function getGoogleAccessToken() {
  const credentials = await readGoogleOAuthClient();
  const client = credentials.installed || credentials.web;
  const token = await readGoogleOAuthToken();

  if (token.access_token && token.expires_at && token.expires_at > Date.now() + 60000) {
    return token.access_token;
  }

  if (!token.refresh_token) {
    throw new Error("Google OAuth token needs a refresh_token. Re-run scripts/google-oauth.mjs.");
  }

  const response = await fetch(client.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: client.client_id,
      client_secret: client.client_secret,
      refresh_token: token.refresh_token,
      grant_type: "refresh_token"
    })
  });

  if (!response.ok) {
    throw new Error(`Google token refresh failed: ${response.status} ${await response.text()}`);
  }

  const refreshed = await response.json();
  const nextToken = {
    ...token,
    ...refreshed,
    expires_at: Date.now() + (refreshed.expires_in || 3600) * 1000
  };
  if (!config.googleOAuthTokenJson && !config.googleOAuthRefreshToken) {
    await writeFile(config.googleOAuthTokenFile, `${JSON.stringify(nextToken, null, 2)}\n`, { mode: 0o600 });
  }
  return nextToken.access_token;
}

function hasGoogleOAuthConfig() {
  return Boolean(
    config.googleOAuthClientFile ||
    config.googleOAuthClientJson ||
    (config.googleOAuthClientId && config.googleOAuthClientSecret && config.googleOAuthRefreshToken)
  );
}

async function readGoogleOAuthClient() {
  if (config.googleOAuthClientJson) {
    return JSON.parse(config.googleOAuthClientJson);
  }

  if (config.googleOAuthClientId && config.googleOAuthClientSecret) {
    return {
      installed: {
        client_id: config.googleOAuthClientId,
        client_secret: config.googleOAuthClientSecret,
        token_uri: "https://oauth2.googleapis.com/token"
      }
    };
  }

  return JSON.parse(await readFile(config.googleOAuthClientFile, "utf8"));
}

async function readGoogleOAuthToken() {
  if (config.googleOAuthTokenJson) {
    return JSON.parse(config.googleOAuthTokenJson);
  }

  if (config.googleOAuthRefreshToken) {
    return { refresh_token: config.googleOAuthRefreshToken };
  }

  return JSON.parse(await readFile(config.googleOAuthTokenFile, "utf8"));
}

function parseSheetRows(rows, tab) {
  const maxDay = daysInMonth(tab.year, tab.month);

  return rows
    .slice(1)
    .filter((row) => {
      const rawDay = String(row[0] ?? "").trim();
      const day = Number(rawDay);
      return /^\d+$/.test(rawDay) && day >= 1 && day <= maxDay;
    })
    .map((row) => {
      const day = toNumber(row[0]);
      const date = `${tab.year}-${String(tab.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const sources = {};

      for (const source of sourceDefinitions) {
        sources[source.id] = {};
        for (const [metric, index] of Object.entries(source.columns)) {
          sources[source.id][metric] = toNumber(row[index]);
        }
      }

      return { date, day, sources };
    });
}

function parseMonthlyTotalRows(rows, tab) {
  const totalRow = findMonthlyTotalRow(rows, tab);

  if (!totalRow) return [];

  const sources = {};
  for (const source of sourceDefinitions) {
    sources[source.id] = {};
    for (const [metric, index] of Object.entries(source.columns)) {
      sources[source.id][metric] = toNumber(totalRow[index]);
    }
  }

  return [{
    date: monthComparisonEnd(tab),
    day: null,
    sources,
    monthlyTotal: true
  }];
}

function findMonthlyTotalRow(rows, tab) {
  const maxDay = daysInMonth(tab.year, tab.month);

  for (let index = 0; index < rows.length - 1; index += 1) {
    const headerRow = rows[index];
    const candidateRow = rows[index + 1];
    const rawDay = String(candidateRow[0] ?? "").trim();
    const day = Number(rawDay);

    if (/^\d+$/.test(rawDay) && day >= 1 && day <= maxDay) continue;
    if (!sourceDefinitions.some((source) => toNumber(candidateRow[source.columns.leads]) > 0)) continue;
    if (monthlyTotalHeaderScore(headerRow) >= 3) return candidateRow;
  }

  return null;
}

function monthlyTotalHeaderScore(row) {
  let score = 0;

  for (const source of sourceDefinitions) {
    const columns = source.columns;
    if (/not\s+qualified/i.test(cleanText(row[columns.notQualified]))) score += 1;
    if (/qualified/i.test(cleanText(row[columns.qualified]))) score += 1;
    if (/reunion\s+lender/i.test(cleanText(row[columns.lender]))) score += 1;
    if (/reuniones?\s+agendada/i.test(cleanText(row[columns.meetings]))) score += 1;
    if (/no\s+show/i.test(cleanText(row[columns.noShows]))) score += 1;
    if (/closed/i.test(cleanText(row[columns.closed]))) score += 1;
  }

  return score;
}

function parseMeetingRows(rows, tab) {
  const meetingRows = [];
  const tables = findMeetingTables(rows);

  for (const table of tables) {
    for (const row of rows.slice(table.headerRow + 1)) {
      const name = cleanText(row[table.name]);
      const status = cleanText(row[table.status]);
      const rawNumber = cleanText(row[table.number]);

      if (!name || !/^\d+$/.test(rawNumber) || isMeetingListHeader(name) || !hasLetters(name)) continue;

      const date = parseSheetDate(row[table.date], tab);
      const normalizedStatus = normalizeMeetingStatus(status);
      const closed = normalizedStatus === "closed";

      meetingRows.push({
        sourceId: table.sourceId,
        month: tab.name,
        sortDate: date || `${tab.year}-${String(tab.month).padStart(2, "0")}-99`,
        date,
        dateKnown: Boolean(date),
        weekOfMonth: date ? weekOfMonth(date) : null,
        client: name,
        type: "Construction",
        status: normalizedStatus,
        statusLabel: closed ? "Closed" : "",
        closed
      });
    }
  }

  return meetingRows.sort((a, b) => a.sortDate.localeCompare(b.sortDate) || a.client.localeCompare(b.client));
}

function findMeetingTables(rows) {
  const tables = [];

  rows.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (!/reunion\s+agendad/i.test(cleanText(value))) return;

      const sourceId = sourceIdForMeetingColumn(columnIndex);
      if (!sourceId) return;

      const status = findHeaderColumn(row, columnIndex, /atendida/i);
      const date = findHeaderColumn(row, columnIndex, /dia\s+fecha|fecha/i);
      const number = findNumberColumn(row, columnIndex);

      if (status === null || number === null) return;

      tables.push({
        sourceId,
        headerRow: rowIndex,
        number,
        name: columnIndex,
        date,
        status
      });
    });
  });

  return tables;
}

function sourceIdForMeetingColumn(columnIndex) {
  if (columnIndex < 10) return "south-texas-builder";
  if (columnIndex >= 19) return "cuates";
  return null;
}

function findHeaderColumn(row, startColumn, pattern) {
  for (let index = startColumn; index <= Math.min(startColumn + 6, row.length - 1); index += 1) {
    if (pattern.test(cleanText(row[index]))) return index;
  }

  return null;
}

function findNumberColumn(row, nameColumn) {
  for (let index = nameColumn - 1; index >= Math.max(0, nameColumn - 3); index -= 1) {
    if (cleanText(row[index]) === "#") return index;
  }

  return nameColumn - 1 >= 0 ? nameColumn - 1 : null;
}

function parseSheetDate(value, tab) {
  const raw = cleanText(value);
  if (!raw) return null;

  const parts = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!parts) return null;

  const month = Number(parts[1]);
  const day = Number(parts[2]);
  let year = Number(parts[3]);
  if (year < 100) year += 2000;

  if (year !== tab.year || month !== tab.month || day < 1 || day > daysInMonth(year, month)) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

async function fetchMetaSpend(range, options = {}) {
  const accounts = Object.entries(config.metaAccounts).filter(([sourceId, accountId]) => accountId && config.metaTokens[sourceId]);

  if (!accounts.length) {
    return { live: false, rows: demoSpend };
  }

  const results = await Promise.all(accounts.map(async ([sourceId, accountId]) => {
    try {
      const cacheKey = `meta:${options.includeCreatives ? "creative" : "base"}:${sourceId}:${accountId}:${range.since}:${range.until}`;
      const rows = await cached(cacheKey, () => {
        if (!options.includeCampaigns && !options.includeCreatives) {
          return fetchMetaAccountSummary(sourceId, accountId, range);
        }
        return fetchMetaAccountSpend(sourceId, accountId, range, options);
      });
      return { rows, error: null };
    } catch (error) {
      return { rows: [], error: error.message };
    }
  }));

  const rows = results.flatMap((result) => result.rows);
  const errors = results.map((result) => result.error).filter(Boolean);

  if (!rows.length && errors.length) {
    throw new Error(errors.join(" | "));
  }

  return { live: true, rows, errors };
}

async function fetchMetaAccountSummary(sourceId, accountId, range) {
  const token = config.metaTokens[sourceId];
  const account = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  const params = new URLSearchParams({
    access_token: token,
    level: "account",
    fields: "spend,reach,impressions,clicks,inline_link_clicks,actions,action_values,date_start,date_stop",
    time_increment: "1",
    time_range: JSON.stringify({ since: range.since, until: range.until }),
    limit: "500"
  });
  let url = `https://graph.facebook.com/${config.metaVersion}/${account}/insights?${params}`;
  const rows = [];

  while (url) {
    const response = await fetch(url);

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Meta API request failed for ${sourceName(sourceId)}: ${response.status} ${body}`);
    }

    const payload = await response.json();
    rows.push(...(payload.data || []).map((row) => ({
      sourceId,
      date: row.date_start,
      campaignId: "",
      campaign: "",
      adId: "",
      adName: "",
      spend: toNumber(row.spend),
      reach: toNumber(row.reach),
      impressions: toNumber(row.impressions),
      clicks: toNumber(row.clicks),
      linkClicks: toNumber(row.inline_link_clicks),
      leads: extractActionValue(row.actions, ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead", "leadgen_grouped"]),
      conversions: extractActionValue(row.actions, ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead", "leadgen_grouped", "onsite_conversion.messaging_conversation_started_7d"]),
      conversionValue: extractActionValue(row.action_values, ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"])
    })));

    url = payload.paging?.next || "";
  }

  return rows;
}

async function fetchMetaAccountSpend(sourceId, accountId, range, options = {}) {
  const token = config.metaTokens[sourceId];
  const account = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  const params = new URLSearchParams({
    access_token: token,
    level: "ad",
    fields: "campaign_id,campaign_name,ad_id,ad_name,spend,reach,impressions,clicks,inline_link_clicks,actions,action_values,date_start,date_stop",
    time_increment: "1",
    time_range: JSON.stringify({ since: range.since, until: range.until }),
    limit: "500"
  });
  let url = `https://graph.facebook.com/${config.metaVersion}/${account}/insights?${params}`;
  const rows = [];

  while (url) {
    const response = await fetch(url);

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Meta API request failed for ${sourceName(sourceId)}: ${response.status} ${body}`);
    }

    const payload = await response.json();
    rows.push(...(payload.data || []).map((row) => ({
      sourceId,
      date: row.date_start,
      campaignId: row.campaign_id || row.campaign_name || "unknown",
      campaign: row.campaign_name || "Unknown campaign",
      adId: row.ad_id || row.ad_name || "unknown",
      adName: row.ad_name || "Unknown ad",
      spend: toNumber(row.spend),
      reach: toNumber(row.reach),
      impressions: toNumber(row.impressions),
      clicks: toNumber(row.clicks),
      linkClicks: toNumber(row.inline_link_clicks),
      leads: extractActionValue(row.actions, ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead", "leadgen_grouped"]),
      conversions: extractActionValue(row.actions, ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead", "leadgen_grouped", "onsite_conversion.messaging_conversation_started_7d"]),
      conversionValue: extractActionValue(row.action_values, ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"])
    })));

    url = payload.paging?.next || "";
  }

  if (!options.includeCreatives) return rows;

  const creativeUrls = await fetchMetaAdCreativeUrls(sourceId, rows);
  return rows.map((row) => ({
    ...row,
    thumbnailUrl: creativeUrls.get(row.adId) || ""
  }));
}

async function fetchMetaAdCreativeUrls(sourceId, rows) {
  const token = config.metaTokens[sourceId];
  const adIds = topCreativeAdIds(rows);
  const entries = await Promise.all(adIds.map(async (adId) => {
    try {
      const imageUrl = await cached(`meta-creative:${sourceId}:${adId}`, async () => {
        const params = new URLSearchParams({
          access_token: token,
          fields: "creative{thumbnail_url,image_url}"
        });
        const response = await fetch(`https://graph.facebook.com/${config.metaVersion}/${adId}?${params}`);
        if (!response.ok) return "";
        const payload = await response.json();
        return payload.creative?.thumbnail_url || payload.creative?.image_url || "";
      });
      return [adId, imageUrl];
    } catch {
      return [adId, ""];
    }
  }));

  return new Map(entries);
}

function topCreativeAdIds(rows) {
  const ads = new Map();

  for (const row of rows) {
    if (!row.adId || row.adId === "unknown") continue;
    const ad = ads.get(row.adId) || { adId: row.adId, leads: 0, spend: 0, impressions: 0 };
    ad.leads += row.leads || 0;
    ad.spend += row.spend || 0;
    ad.impressions += row.impressions || 0;
    ads.set(row.adId, ad);
  }

  return [...ads.values()]
    .sort((a, b) => {
      if (b.leads !== a.leads) return b.leads - a.leads;
      if (b.spend !== a.spend) return b.spend - a.spend;
      return b.impressions - a.impressions;
    })
    .slice(0, 24)
    .map((ad) => ad.adId);
}

function buildSourceTotals(sheetDaily, spendRows, meetingRows = [], options = {}) {
  return sourceDefinitions.map((source) => {
    const sheetTotals = emptyMetrics();

    for (const day of sheetDaily) {
      addMetrics(sheetTotals, day.sources[source.id]);
    }

    const sourceSpendRows = spendRows.filter((row) => belongsToSource(row, source));
    const spend = sourceSpendRows.reduce((sum, row) => sum + row.spend, 0);

    return enrichMetrics({
      id: source.id,
      name: source.name,
      spend,
      reach: sumField(sourceSpendRows, "reach"),
      impressions: sumField(sourceSpendRows, "impressions"),
      clicks: sumField(sourceSpendRows, "clicks"),
      linkClicks: sumField(sourceSpendRows, "linkClicks"),
      campaignBreakdown: options.includeCampaigns ? buildCampaignBreakdown(sourceSpendRows) : [],
      meetingList: meetingRows.filter((row) => row.sourceId === source.id),
      ...sheetTotals
    });
  });
}

function buildCampaignBreakdown(rows) {
  const campaigns = new Map();

  for (const row of rows) {
    const id = row.campaignId || row.campaign || "unknown";
    const campaign = campaigns.get(id) || {
      id,
      name: row.campaign || "Unknown campaign",
      category: campaignCategory(row.campaign),
      spend: 0,
      reach: 0,
      impressions: 0,
      clicks: 0,
      linkClicks: 0,
      leads: 0,
      conversions: 0,
      conversionValue: 0,
      ads: new Map()
    };

    campaign.spend += row.spend || 0;
    campaign.reach += row.reach || 0;
    campaign.impressions += row.impressions || 0;
    campaign.clicks += row.clicks || 0;
    campaign.linkClicks += row.linkClicks || 0;
    campaign.leads += row.leads || 0;
    campaign.conversions += row.conversions || 0;
    campaign.conversionValue += row.conversionValue || 0;
    addAdMetrics(campaign.ads, row);
    campaigns.set(id, campaign);
  }

  return [...campaigns.values()]
    .map(enrichCampaign)
    .sort((a, b) => b.spend - a.spend);
}

function addAdMetrics(ads, row) {
  const id = row.adId || row.adName || "unknown";
  const ad = ads.get(id) || {
    id,
    name: row.adName || "Unknown ad",
    thumbnailUrl: row.thumbnailUrl || "",
    spend: 0,
    reach: 0,
    impressions: 0,
    clicks: 0,
    linkClicks: 0,
    leads: 0,
    conversions: 0,
    conversionValue: 0
  };

  ad.spend += row.spend || 0;
  ad.reach += row.reach || 0;
  ad.impressions += row.impressions || 0;
  ad.clicks += row.clicks || 0;
  ad.linkClicks += row.linkClicks || 0;
  ad.leads += row.leads || 0;
  ad.conversions += row.conversions || 0;
  ad.conversionValue += row.conversionValue || 0;
  if (!ad.thumbnailUrl && row.thumbnailUrl) ad.thumbnailUrl = row.thumbnailUrl;
  ads.set(id, ad);
}

function enrichCampaign(campaign) {
  const topAds = [...campaign.ads.values()]
    .map((ad) => ({
      ...ad,
      ctr: safeDivide(ad.clicks, ad.impressions),
      cpc: safeDivide(ad.spend, ad.clicks),
      cpm: safeDivide(ad.spend, ad.impressions) * 1000,
      frequency: safeDivide(ad.impressions, ad.reach),
      costPerLead: safeDivide(ad.spend, ad.leads),
      roas: safeDivide(ad.conversionValue, ad.spend)
    }))
    .sort((a, b) => {
      if (b.leads !== a.leads) return b.leads - a.leads;
      return b.spend - a.spend;
    })
    .slice(0, 5);

  return {
    ...campaign,
    ads: topAds,
    ctr: safeDivide(campaign.clicks, campaign.impressions),
    cpc: safeDivide(campaign.spend, campaign.clicks),
    cpm: safeDivide(campaign.spend, campaign.impressions) * 1000,
    frequency: safeDivide(campaign.impressions, campaign.reach),
    costPerLead: safeDivide(campaign.spend, campaign.leads),
    roas: safeDivide(campaign.conversionValue, campaign.spend)
  };
}

function campaignCategory(name = "") {
  const normalized = String(name).toLowerCase();
  if (normalized.includes("client") || normalized.includes("testimonial") || normalized.includes("review")) return "Clients";
  if (normalized.includes("funnel") || normalized.includes("traffic") || normalized.includes("awareness") || normalized.includes("video")) return "Funnel";
  return "Conversions";
}

function buildTimeline(sheetDaily, spendRows, granularity) {
  const buckets = new Map();

  for (const day of sheetDaily) {
    const key = granularity === "monthly" ? day.date.slice(0, 7) : granularity === "weekly" ? weekKey(day.date) : day.date;
    const bucket = buckets.get(key) || { label: key, spend: 0, leads: 0, meetings: 0, attended: 0, closed: 0 };
    for (const source of sourceDefinitions) {
      const metrics = day.sources[source.id];
      bucket.leads += metrics.leads;
      bucket.meetings += metrics.meetings;
      bucket.attended += metrics.attended;
      bucket.closed += metrics.closed;
    }
    buckets.set(key, bucket);
  }

  for (const row of spendRows) {
    const key = granularity === "monthly" ? row.date.slice(0, 7) : granularity === "weekly" ? weekKey(row.date) : row.date;
    const bucket = buckets.get(key) || { label: key, spend: 0, leads: 0, meetings: 0, attended: 0, closed: 0 };
    bucket.spend += row.spend;
    buckets.set(key, bucket);
  }

  return [...buckets.values()]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map(enrichMetrics);
}

function sumTotals(sourceTotals) {
  return enrichMetrics(sourceTotals.reduce((total, source) => {
    for (const key of ["spend", "leads", "qualified", "lender", "meetings", "attended", "closed", "noShows", "impressions", "clicks"]) {
      total[key] = (total[key] || 0) + (source[key] || 0);
    }
    return total;
  }, {}));
}

function enrichMetrics(metrics) {
  const result = { ...metrics };
  result.costPerLead = safeDivide(result.spend, result.leads);
  result.costPerLenderMeeting = safeDivide(result.spend, result.lender);
  result.costPerMeeting = safeDivide(result.spend, result.meetings);
  result.costPerAttended = safeDivide(result.spend, result.attended);
  result.cac = safeDivide(result.spend, result.closed);
  result.meetingRate = safeDivide(result.meetings, result.leads);
  result.closeRate = safeDivide(result.closed, result.meetings);
  result.showRate = safeDivide(result.attended, result.meetings);
  return result;
}

function emptyMetrics() {
  return { leads: 0, noAnswer: 0, notQualified: 0, qualified: 0, lender: 0, meetings: 0, noShows: 0, attended: 0, closed: 0 };
}

function addMetrics(target, source) {
  for (const key of Object.keys(target)) {
    target[key] += source[key] || 0;
  }
}

function belongsToSource(row, source) {
  if (row.sourceId) {
    return row.sourceId === source.id;
  }

  const normalized = String(row.campaign || "").toLowerCase();
  return source.campaignMatch.some((word) => normalized.includes(word));
}

function sourceName(sourceId) {
  return sourceDefinitions.find((source) => source.id === sourceId)?.name || sourceId;
}

function sumField(rows, field) {
  return rows.reduce((sum, row) => sum + (row[field] || 0), 0);
}

function extractActionValue(actions = [], keys = []) {
  if (!Array.isArray(actions)) return 0;
  const wanted = new Set(keys);
  return actions.reduce((total, action) => {
    return wanted.has(action.action_type) ? total + toNumber(action.value) : total;
  }, 0);
}

function normalizeRange(since, until) {
  const fallback = { since: config.metaSince, until: config.metaUntil };
  const range = {
    since: isDateString(since) ? since : fallback.since,
    until: isDateString(until) ? until : fallback.until
  };

  if (range.since > range.until) {
    return { since: range.until, until: range.since };
  }

  return range;
}

function isWithinRange(date, range) {
  return date >= range.since && date <= range.until;
}

function shouldUseMonthlyTotal(tab, range) {
  const start = `${tab.year}-${String(tab.month).padStart(2, "0")}-01`;
  return range.since <= start && range.until >= monthComparisonEnd(tab);
}

function monthComparisonEnd(tab) {
  const month = String(tab.month).padStart(2, "0");
  const end = `${tab.year}-${month}-${String(daysInMonth(tab.year, tab.month)).padStart(2, "0")}`;
  const today = localDate(new Date());
  return today.startsWith(`${tab.year}-${month}`) && today < end ? today : end;
}

function isDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function parseSheetTabs(value) {
  if (value) {
    try {
      const tabs = JSON.parse(value);
      if (Array.isArray(tabs) && tabs.length) return tabs;
    } catch {
      // Fall back to the known public tabs below.
    }
  }

  return [
    { year: 2026, month: 1, gid: "0", name: "January" },
    { year: 2026, month: 2, gid: "608102", name: "February" },
    { year: 2026, month: 3, gid: "1610026683", name: "March" },
    { year: 2026, month: 4, gid: "413460675", name: "April" },
    { year: 2026, month: 5, gid: "2083481286", name: "May" }
  ];
}

function monthOverlapsRange(tab, range) {
  const start = `${tab.year}-${String(tab.month).padStart(2, "0")}-01`;
  const end = `${tab.year}-${String(tab.month).padStart(2, "0")}-${String(daysInMonth(tab.year, tab.month)).padStart(2, "0")}`;
  return start <= range.until && end >= range.since;
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function weekKey(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`);
  const start = new Date(date);
  start.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return start.toISOString().slice(0, 10);
}

function weekOfMonth(dateString) {
  return Math.ceil(Number(dateString.slice(8, 10)) / 7);
}

function safeDivide(numerator = 0, denominator = 0) {
  return denominator ? numerator / denominator : 0;
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeMeetingStatus(value) {
  const normalized = cleanText(value).toLowerCase();
  if (normalized.includes("cerrad") || normalized.includes("closed")) return "closed";
  if (normalized.includes("atendid") || normalized.includes("attend")) return "attended";
  if (normalized.includes("show")) return "no-show";
  return normalized || "unknown";
}

function isMeetingListHeader(value) {
  const normalized = cleanText(value).toLowerCase();
  return normalized.includes("reunion") || normalized.includes("week") || normalized.includes("total") || normalized.includes("atendida");
}

function hasLetters(value) {
  return /[a-z]/i.test(cleanText(value));
}

function toNumber(value) {
  const cleaned = String(value ?? "").replace(/[$,%\s,]/g, "");
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

async function serveStatic(urlPath, res) {
  const cleanPath = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.normalize(path.join(publicDir, cleanPath));
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  let file;
  try {
    file = await readFile(filePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      res.writeHead(404);
      return res.end("Not found");
    }
    throw error;
  }
  const ext = path.extname(filePath);
  const type = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".svg": "image/svg+xml"
  }[ext] || "application/octet-stream";

  res.writeHead(200, { "content-type": type });
  res.end(file);
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(data));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body is too large"));
      }
    });
    req.on("end", () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON request body"));
      }
    });
    req.on("error", reject);
  });
}

function readLoginBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 100_000) {
        req.destroy();
        reject(new Error("Request body is too large"));
      }
    });
    req.on("end", () => {
      const contentType = req.headers["content-type"] || "";
      if (contentType.includes("application/json")) {
        try {
          return resolve({ body: raw.trim() ? JSON.parse(raw) : {}, wantsHtml: false });
        } catch {
          return reject(new Error("Invalid JSON request body"));
        }
      }

      const params = new URLSearchParams(raw);
      resolve({
        body: { password: params.get("password") || "" },
        wantsHtml: true
      });
    });
    req.on("error", reject);
  });
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function roundRate(value) {
  return Math.round((Number(value) || 0) * 10000) / 10000;
}

function bestByLeads(rows) {
  return [...rows].sort((a, b) => {
    if ((b.leads || 0) !== (a.leads || 0)) return (b.leads || 0) - (a.leads || 0);
    return (b.spend || 0) - (a.spend || 0);
  })[0] || null;
}

function previousWeekRange() {
  const today = new Date();
  const day = today.getDay();
  const daysSinceFriday = (day + 2) % 7;
  const friday = addDays(today, -daysSinceFriday);
  const priorFriday = addDays(friday, -7);
  return {
    since: localDate(priorFriday),
    until: localDate(friday)
  };
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function previousDate(dateString) {
  return localDate(addDays(new Date(`${dateString}T00:00:00`), -1));
}

function localDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function formatReportDate(value) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function formatMoneyText(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function formatMoneyOrNA(value) {
  return value === null || value === undefined ? "N/A" : formatMoneyText(value);
}

function parseEmailList(value) {
  const seen = new Set();
  return String(value || "")
    .split(/[,\n;]/)
    .map((email) => email.trim())
    .filter(Boolean)
    .filter((email) => {
      const normalized = email.toLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
}

function isProtectedRequest(urlPath) {
  if (!config.dashboardPassword) return false;
  return urlPath.startsWith("/api/") && !["/api/login", "/api/logout", "/api/session"].includes(urlPath);
}

function isAuthenticated(req) {
  if (!config.dashboardPassword) return true;
  return parseCookies(req.headers.cookie || "")[config.sessionCookie] === "1";
}

function parseCookies(cookieHeader) {
  return Object.fromEntries(String(cookieHeader || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const index = item.indexOf("=");
      if (index === -1) return [item, ""];
      return [item.slice(0, index), decodeURIComponent(item.slice(index + 1))];
    }));
}

function isMainModule() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}

async function cached(key, fetcher) {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.time < cacheTtlMs) {
    return hit.value;
  }

  const value = await fetcher();
  cache.set(key, { time: now, value });
  return value;
}

function loadDotEnv() {
  try {
    const envPath = path.join(__dirname, ".env");
    const env = readFileSync(envPath, "utf8");
    for (const line of env.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && process.env[match[1]] === undefined) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // .env is optional.
  }
}
