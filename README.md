# Pulse - Live Sentiment Dashboard

Pulse is a React + Node.js web app that tracks sentiment around a topic by:

1. Pulling up to 20 recent items from News API.
2. Sending headlines/descriptions to Hugging Face Inference API for sentiment classification.
3. Rendering a premium dashboard with score, trend, summary, and source links.

## Stack

- Frontend: React + Vite + Recharts
- Backend: Node.js + Express
- Data source: [NewsAPI](https://newsapi.org)
- AI analysis: Hugging Face Inference API

## Setup

### 1) Install dependencies

```bash
npm install
npm install --prefix server
npm install --prefix client
```

### 2) Configure environment variables

Copy examples:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Set your keys in `server/.env`:

- `NEWS_API_KEY` (required)
- `HF_API_KEY` (required)

Models used:

- Sentiment: `cardiffnlp/twitter-roberta-base-sentiment-latest`
- Summary: `facebook/bart-large-cnn`

### 3) Run locally

```bash
npm run dev:server
npm run dev:client
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`

## API

### `GET /api/analyze?topic=<query>`

Returns:

- `score` (0-100)
- `counts` (positive/negative/neutral)
- `summary` (3-5 sentences)
- `trend` data for grouped chart
- `sources` list with sentiment labels and links

### `GET /api/health`

Simple health check.
