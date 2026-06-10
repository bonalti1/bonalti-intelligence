import { createDailyTextReport, sendDailyTextReport } from "../server.mjs";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const force = args.has("--force");
const range = getCliRange();

if (!dryRun && process.env.DAILY_REPORT_ENABLED !== "true" && !force) {
  console.log("Daily text report is turned off. Set DAILY_REPORT_ENABLED=true or use --force.");
  process.exit(0);
}

const report = await createDailyTextReport(range);

if (dryRun) {
  console.log(report.text);
} else {
  const result = await sendDailyTextReport(report);
  console.log(`Daily text report sent: ${result.map((item) => item.sid || "ok").join(", ")}`);
}

function getCliRange() {
  const dateArg = process.argv.find((arg) => arg.startsWith("--date="));
  if (dateArg) {
    const date = dateArg.split("=")[1];
    return { since: date, until: date };
  }

  const sinceArg = process.argv.find((arg) => arg.startsWith("--since="));
  const untilArg = process.argv.find((arg) => arg.startsWith("--until="));
  if (!sinceArg || !untilArg) return undefined;
  return {
    since: sinceArg.split("=")[1],
    until: untilArg.split("=")[1]
  };
}
