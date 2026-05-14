import { createWeeklyReport, getReportSettings, sendWeeklyReportEmail } from "../server.mjs";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const range = getCliRange();
const settings = await getReportSettings();

if (!dryRun && !settings.enabled) {
  console.log("Weekly report email is turned off. Nothing sent.");
  process.exit(0);
}

const report = await createWeeklyReport(range);

if (dryRun) {
  console.log(report.text);
} else {
  const result = await sendWeeklyReportEmail(report, settings.toEmail);
  console.log(`Weekly report sent: ${result.id || "ok"}`);
}

function getCliRange() {
  const sinceArg = process.argv.find((arg) => arg.startsWith("--since="));
  const untilArg = process.argv.find((arg) => arg.startsWith("--until="));
  if (!sinceArg || !untilArg) return undefined;
  return {
    since: sinceArg.split("=")[1],
    until: untilArg.split("=")[1]
  };
}
