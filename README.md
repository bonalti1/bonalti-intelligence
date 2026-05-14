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
