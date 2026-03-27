import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Search, UserCircle2 } from "lucide-react";

const COLORS = {
  positive: "#68D391",
  negative: "#FC8181",
  neutral: "#F6AD55",
  blue: "#2563EB"
};

const INITIAL_DATA = {
  topic: "Market sentiment",
  score: 50,
  sentimentLabel: "Mixed sentiment",
  counts: { positive: 0, negative: 0, neutral: 0 },
  trend: [
    { month: "Jan", positive: 0, negative: 0 },
    { month: "Feb", positive: 0, negative: 0 },
    { month: "Mar", positive: 0, negative: 0 },
    { month: "Apr", positive: 0, negative: 0 },
    { month: "May", positive: 0, negative: 0 },
    { month: "Jun", positive: 0, negative: 0 }
  ],
  summary:
    "Type a topic and click Analyze. Pulse will fetch recent discussions, run sentiment scoring, and generate an AI summary.",
  tags: ["Live tracking", "Media pulse", "Narrative analysis"],
  sources: []
};

function App() {
  const [topic, setTopic] = useState("Donald Trump");
  const [data, setData] = useState(INITIAL_DATA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timeRange, setTimeRange] = useState("6M");

  const total = useMemo(
    () => data.counts.positive + data.counts.negative + data.counts.neutral,
    [data]
  );

  const pieData = [
    { name: "Positive", value: data.counts.positive, color: COLORS.positive },
    { name: "Negative", value: data.counts.negative, color: COLORS.negative },
    { name: "Neutral", value: data.counts.neutral, color: COLORS.neutral }
  ];

  const percentages = {
    positive: total ? Math.round((data.counts.positive / total) * 100) : 0,
    negative: total ? Math.round((data.counts.negative / total) * 100) : 0,
    neutral: total ? Math.round((data.counts.neutral / total) * 100) : 0
  };

  const analyze = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError("");
    try {
      const apiUrl = "http://localhost:4000/api/analyze";
      console.log("Calling API at:", apiUrl);
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ topic: topic.trim() })
      });
      const responseText = await response.text();
      const json = JSON.parse(responseText);
      if (!response.ok) {
        throw new Error(json.error || "Failed to analyze topic");
      }
      setData(json);
    } catch (err) {
      console.error("API ERROR:", err?.response?.data || err?.message);
      setError(err.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <nav className="topbar glass">
        <div className="brand">
          <div className="logo">P</div>
          <span>Pulse</span>
        </div>

        <div className="searchWrap">
          <Search size={16} />
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && analyze()}
            placeholder="Search topic or person..."
          />
          <button onClick={analyze} disabled={loading}>
            {loading ? "Analyzing..." : "Analyze"}
          </button>
        </div>

        <div className="rightStatus">
          <div className="liveDot" />
          <span>Live</span>
          <UserCircle2 size={30} color="#A0AEC0" />
        </div>
      </nav>

      {error && <div className="errorBanner">{error}</div>}

      <main className="gridLayout">
        <section className="card sentimentCard glass">
          <p className="label">Sentiment Score</p>
          <h1>{data.score}/100</h1>
          <p className="topic">{data.topic}</p>
          <span className="badge">{data.sentimentLabel}</span>

          <div className="meter">
            <label>Positive {percentages.positive}%</label>
            <div className="track">
              <div
                className="fill positive"
                style={{ width: `${percentages.positive}%` }}
              />
            </div>
          </div>
          <div className="meter">
            <label>Negative {percentages.negative}%</label>
            <div className="track">
              <div
                className="fill negative"
                style={{ width: `${percentages.negative}%` }}
              />
            </div>
          </div>
          <div className="meter">
            <label>Neutral {percentages.neutral}%</label>
            <div className="track">
              <div
                className="fill neutral"
                style={{ width: `${percentages.neutral}%` }}
              />
            </div>
          </div>
        </section>

        <section className="card trendCard glass">
          <div className="cardHead">
            <h3>Sentiment Trend</h3>
            <div className="pillFilters">
              {["1W", "1M", "6M", "1Y"].map((range) => (
                <button
                  key={range}
                  className={range === timeRange ? "active" : ""}
                  onClick={() => setTimeRange(range)}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
          <div className="chartWrap">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.trend}>
                <XAxis dataKey="month" stroke="#4A5568" />
                <YAxis stroke="#4A5568" />
                <Tooltip
                  cursor={{ fill: "rgba(37,99,235,0.06)" }}
                  contentStyle={{
                    background: "#111827",
                    border: "1px solid rgba(99,179,237,0.1)",
                    color: "#E2E8F0"
                  }}
                />
                <Bar dataKey="positive" fill="#2563EB" radius={[4, 4, 0, 0]} />
                <Bar dataKey="negative" fill="#FC8181" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card statCard glass">
          <p>Positive</p>
          <h2 style={{ color: COLORS.positive }}>{data.counts.positive}</h2>
          <span>+4.2% WoW</span>
        </section>
        <section className="card statCard glass">
          <p>Negative</p>
          <h2 style={{ color: COLORS.negative }}>{data.counts.negative}</h2>
          <span>-1.8% WoW</span>
        </section>
        <section className="card statCard glass">
          <p>Neutral</p>
          <h2 style={{ color: COLORS.neutral }}>{data.counts.neutral}</h2>
          <span>+0.6% WoW</span>
        </section>

        <section className="card summaryCard glass">
          <h3>AI Summary</h3>
          <p>{data.summary}</p>
          <div className="tags">
            {data.tags?.slice(0, 6).map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>

          <div className="miniPie">
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={74}
                  paddingAngle={4}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#111827",
                    border: "1px solid rgba(99,179,237,0.1)"
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card sourceCard glass">
          <h3>Sources</h3>
          <div className="sourceList">
            {data.sources.slice(0, 20).map((item) => (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                key={item.id}
                className="sourceItem"
              >
                <span className={`dot ${item.sentiment}`} />
                <div>
                  <p>{item.title || "Untitled article"}</p>
                  <small>
                    {item.source} · {new Date(item.publishedAt).toLocaleString()}
                  </small>
                </div>
              </a>
            ))}
            {data.sources.length === 0 && <p className="muted">No sources yet.</p>}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
