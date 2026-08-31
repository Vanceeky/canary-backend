// This is a backend/API service, not a product UI (the landing page, web
// dashboard, and mobile app are built separately) — this page just confirms
// the service is up and points at the API reference.
export default function HomePage() {
  return (
    <main className="home">
      <div className="home-card">
        <span className="home-eyebrow">
          <span className="dot" />
          Operational
        </span>
        <h1>Canary API</h1>
        <p>
          REST API for the Canary error-monitoring backend — event ingestion, project/team
          management, error queries, and admin oversight, served over one contract for the SDK,
          web dashboard, and mobile app.
        </p>
        <div className="home-meta">
          <span>/api/v1</span>
          <span>JSON</span>
          <span>PostgreSQL + Prisma</span>
        </div>
        <div className="home-actions">
          <a className="home-btn home-btn-primary" href="/docs.html">
            View API Reference
          </a>
          <a
            className="home-btn home-btn-secondary"
            href="https://github.com/Vanceeky/canary-backend"
            target="_blank"
            rel="noreferrer"
          >
            Source on GitHub
          </a>
        </div>
      </div>
    </main>
  );
}
