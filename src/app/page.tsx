export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 720, lineHeight: 1.5 }}>
      <h1>broker-api</h1>
      <p>Portfolio storage, TCBS proxy, snapshots, and price alerts for the Blazor trading desk.</p>
      <ul>
        <li><a href="/api/health">Health</a></li>
        <li><a href="/openapi.yaml">OpenAPI</a></li>
      </ul>
    </main>
  );
}
