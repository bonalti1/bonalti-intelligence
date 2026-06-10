# Bonalti Lead Intelligence

This dashboard combines Google Sheet meeting/lead counts with Meta Ads spend, campaign/ad performance, AI executive summaries, AI dashboard chat, and weekly email reporting.

## Run it

```bash
npm start
```

Then open:

```text
http://localhost:4173
```

## Deploy

Use Render as a Node web service:

```text
Build Command: npm install
Start Command: npm start
```

Add private keys in Render environment variables. Do not commit `.env`.

## Required Environment

```text
DASHBOARD_PASSWORD=Bonalti!
GOOGLE_SHEET_ID=1rjmXjtyBTmch7SJY58cA8ZGKYWlwPxEe0WOd2Ce9i2Q
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REFRESH_TOKEN=
SOUTH_TEXAS_META_ACCESS_TOKEN=
CUATES_META_ACCESS_TOKEN=
SOUTH_TEXAS_META_AD_ACCOUNT_ID=1539910553623330
CUATES_META_AD_ACCOUNT_ID=391341780114008
OPENAI_API_KEY=
RESEND_API_KEY=
REPORT_FROM_EMAIL=Lead Intelligence <reports@bonalti.com>
REPORT_TO_EMAIL=rolando@alto-realtygroup.com, cristo@alto-realtygroup.com, graciela@alto-realtygroup.com
```

## Main formulas

- Cost per meeting = Meta spend / scheduled meetings
- CAC = Meta spend / closed deals
- Close rate = closed deals / scheduled meetings

## Daily SMS / WhatsApp report

Preview yesterday's daily text:

```bash
npm run daily-text-report:preview
```

Send it manually:

```bash
npm run daily-text-report -- --force
```

The daily text defaults to a 2-day delay so the data-entry sheet has time to be updated. It includes each company, spend, Meta leads, Meta cost per lead, funnel/sheet leads, qualified leads, lender meetings, construction meetings, closed deals, and the best ad from Meta for that day.

Add these Render environment variables before sending:

```text
DAILY_REPORT_ENABLED=true
DAILY_REPORT_CHANNEL=ghl
DAILY_REPORT_TIMEZONE=America/Chicago
DAILY_REPORT_LAG_DAYS=2
DAILY_REPORT_TO=+19562576072
GHL_DAILY_REPORT_WEBHOOK_URL=
```

For HighLevel, paste the inbound webhook URL from the published "Daily Lead Intelligence Report" workflow into `GHL_DAILY_REPORT_WEBHOOK_URL`. The app sends `message` and `phone`; HighLevel creates/updates the contact and sends the SMS body from `{{inboundWebhookRequest.message}}`.

For Twilio SMS, set:

```text
DAILY_REPORT_CHANNEL=sms
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_MESSAGING_SERVICE_SID=
TWILIO_FROM_NUMBER=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

For WhatsApp, set:

```text
DAILY_REPORT_CHANNEL=whatsapp
DAILY_REPORT_TO=whatsapp:+19562576072
```

Schedule `npm run daily-text-report` every day at 8:00 AM Central using a Render Cron Job or another scheduler.
