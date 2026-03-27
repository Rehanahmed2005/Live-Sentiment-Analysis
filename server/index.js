import "dotenv/config";
import cors from "cors";
import express from "express";
import axios from "axios";

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const NEWS_API_URL = "https://newsapi.org/v2/everything";
const HF_API_BASE = "https://router.huggingface.co/hf-inference/models";
const SUMMARY_MODEL = "facebook/bart-large-cnn";
const SENTIMENT_URL =
  "https://router.huggingface.co/hf-inference/models/cardiffnlp/twitter-roberta-base-sentiment-latest";

function sanitizeContent(articles) {
  return articles.map((article, index) => ({
    id: index + 1,
    title: article.title || "",
    description: article.description || "",
    source: article.source?.name || "Unknown source",
    publishedAt: article.publishedAt || "",
    url: article.url || ""
  }));
}

function fallbackAnalysis(topic, items, message) {
  const counts = { positive: 0, negative: 0, neutral: items.length };
  const percentages = { positive: 0, negative: 0, neutral: 100 };
  const score = 50;
  return {
    topic,
    score,
    sentimentLabel: "Model unavailable",
    summary:
      message ||
      "Pulse could not run Hugging Face analysis for this request. Confirm HF_API_KEY and try again.",
    tags: ["Live news", "Trending narratives", "Public sentiment"],
    counts,
    percentages,
    trend: [
      { month: "Jan", positive: 0, negative: 0 },
      { month: "Feb", positive: 0, negative: 0 },
      { month: "Mar", positive: 0, negative: 0 },
      { month: "Apr", positive: 0, negative: 0 },
      { month: "May", positive: 0, negative: 0 },
      { month: "Jun", positive: 0, negative: 0 }
    ],
    sources: items.map((item) => ({ ...item, sentiment: "neutral" }))
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function queryHuggingFace(model, payload, hfKey, retry = true) {
  try {
    const response = await axios.post(`${HF_API_BASE}/${model}`, payload, {
      headers: {
        Authorization: `Bearer ${hfKey}`,
        "Content-Type": "application/json"
      },
      timeout: 45000
    });
    return response.data;
  } catch (error) {
    const status = error?.response?.status;
    const estimatedTime = error?.response?.data?.estimated_time;
    if (retry && status === 503) {
      await sleep((estimatedTime ? Number(estimatedTime) * 1000 : 2500) + 400);
      return queryHuggingFace(model, payload, hfKey, false);
    }
    throw error;
  }
}

function mapLabelToSentiment(label) {
  if (label === "LABEL_2") return "positive";
  if (label === "LABEL_0") return "negative";
  return "neutral";
}

function normalizeSentimentOutput(rawData) {
  if (!Array.isArray(rawData)) return [];
  if (Array.isArray(rawData[0])) return rawData[0];
  return rawData;
}

function getTopSentiment(predictions) {
  if (!predictions.length) return { sentiment: "neutral", confidence: 0 };
  const sorted = [...predictions].sort((a, b) => (b.score || 0) - (a.score || 0));
  const top = sorted[0];
  return {
    sentiment: mapLabelToSentiment(top.label),
    confidence: Number(top.score) || 0
  };
}

async function analyzeSentiment(items) {
  const weightedTotals = { positive: 0, negative: 0, neutral: 0 };

  const analyzedSources = await Promise.all(
    items.map(async (item) => {
      const text = `${item.title}. ${item.description}`.trim() || "No text available";
      const sentimentResponse = await axios.post(
        SENTIMENT_URL,
        { inputs: text },
        {
          headers: {
            Authorization: `Bearer ${process.env.HF_API_KEY}`,
            "Content-Type": "application/json"
          },
          timeout: 45000
        }
      );
      console.log(
        "HF RAW RESPONSE:",
        JSON.stringify(sentimentResponse.data, null, 2)
      );
      const predictionsRaw = sentimentResponse.data;
      const predictions = Array.isArray(predictionsRaw[0])
        ? predictionsRaw[0]
        : predictionsRaw;

      let positive = 0;
      let negative = 0;
      let neutral = 0;

      predictions.forEach((p) => {
        const label = String(p.label || "").toLowerCase();
        if (label === "positive" || label === "label_2") positive = p.score;
        if (label === "negative" || label === "label_0") negative = p.score;
        if (label === "neutral" || label === "label_1") neutral = p.score;
      });

      console.log("PROCESSED SENTIMENT:", { positive, negative, neutral });

      weightedTotals.positive += positive;
      weightedTotals.negative += negative;
      weightedTotals.neutral += neutral;

      const sentiment =
        positive >= negative && positive >= neutral
          ? "positive"
          : negative >= positive && negative >= neutral
            ? "negative"
            : "neutral";
      const confidence = Math.max(positive, negative, neutral);

      return {
        ...item,
        sentiment,
        confidence: Number(confidence.toFixed(4))
      };
    })
  );

  const counts = analyzedSources.reduce(
    (acc, item) => {
      acc[item.sentiment] += 1;
      return acc;
    },
    { positive: 0, negative: 0, neutral: 0 }
  );

  const weightSum =
    weightedTotals.positive + weightedTotals.negative + weightedTotals.neutral;
  const percentages = weightSum
    ? {
        positive: Math.round((weightedTotals.positive / weightSum) * 100),
        negative: Math.round((weightedTotals.negative / weightSum) * 100),
        neutral: Math.round((weightedTotals.neutral / weightSum) * 100)
      }
    : { positive: 0, negative: 0, neutral: 100 };

  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        percentages.positive + percentages.neutral * 0.5 - percentages.negative
      )
    )
  );

  return {
    sources: analyzedSources,
    counts,
    percentages,
    score,
    positive: percentages.positive,
    negative: percentages.negative,
    neutral: percentages.neutral
  };
}

async function summarizeItems(topic, items, hfKey) {
  const combinedText = items
    .map((item) => `${item.title}. ${item.description}`.trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);

  if (!combinedText) {
    return `Coverage around ${topic} is currently limited.`;
  }

  const summaryRaw = await queryHuggingFace(
    SUMMARY_MODEL,
    {
      inputs: combinedText,
      parameters: { max_length: 170, min_length: 80, do_sample: false }
    },
    hfKey
  );

  if (Array.isArray(summaryRaw) && summaryRaw[0]?.summary_text) {
    return summaryRaw[0].summary_text;
  }

  return `Recent discussion around ${topic} is mixed across major sources.`;
}

function buildTags(items) {
  const topSources = [...new Set(items.map((item) => item.source))].slice(0, 3);
  return topSources.length
    ? topSources
    : ["Economy", "Legal cases", "Market narrative"];
}

function generateTrend(counts) {
  const basePos = Math.max(1, Math.round(counts.positive / 2));
  const baseNeg = Math.max(1, Math.round(counts.negative / 2));
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((month, idx) => ({
    month,
    positive: Math.max(0, basePos + ((idx % 3) - 1)),
    negative: Math.max(0, baseNeg + ((2 - (idx % 3)) - 1))
  }));
}

function scoreLabel(score) {
  if (score >= 65) return "Leaning positive";
  if (score <= 40) return "Leaning negative";
  return "Mixed sentiment";
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/analyze", async (req, res) => {
  try {
    console.log("API HIT /api/analyze");
    const topic = String(req.body?.topic || "").trim();

    if (!topic) {
      return res.status(400).json({ error: "Topic is required" });
    }

    if (!process.env.NEWS_API_KEY) {
      return res.status(500).json({ error: "NEWS_API_KEY is not configured" });
    }
    if (!process.env.HF_API_KEY) {
      return res.status(500).json({ error: "HF_API_KEY is not configured" });
    }
    console.log("HF KEY:", process.env.HF_API_KEY ? "Loaded" : "MISSING");

    const newsResponse = await axios.get(NEWS_API_URL, {
      params: {
        q: topic,
        language: "en",
        sortBy: "publishedAt",
        pageSize: 20,
        apiKey: process.env.NEWS_API_KEY
      }
    });

    const articles = sanitizeContent(newsResponse.data.articles || []);
    if (articles.length === 0) {
      return res.json(
        fallbackAnalysis(topic, [], "No recent content found for this topic.")
      );
    }

    const { sources, counts, percentages, score, positive, negative, neutral } =
      await analyzeSentiment(articles);
    const summary = await summarizeItems(topic, articles, process.env.HF_API_KEY);

    const payload = {
      topic,
      score,
      sentimentLabel: scoreLabel(score),
      summary,
      tags: buildTags(sources),
      counts,
      percentages,
      positive,
      negative,
      neutral,
      trend: generateTrend(counts),
      sources
    };
    return res.json(payload);
  } catch (error) {
    const message = error?.response?.data?.error || error?.message;
    if (message?.toLowerCase()?.includes("rate limit")) {
      return res.status(429).json({ error: "Hugging Face rate limit reached" });
    }
    if (message?.toLowerCase()?.includes("authorization")) {
      return res.status(401).json({ error: "Invalid HF_API_KEY" });
    }
    return res.status(500).json({
      error: message || "Unexpected analysis error",
      fallback: fallbackAnalysis(
        String(req.query.topic || "").trim(),
        [],
        "Hugging Face analysis failed for this request."
      )
    });
  }
});

app.listen(port, () => {
  console.log(`Pulse API running on http://localhost:${port}`);
});
