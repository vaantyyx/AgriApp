// Shared safety guard for every script in this folder. Deliberately does
// NOT call dotenv.config() — the real backend/.env sets MONGODB_URI to the
// actual dev/production database, and silently inheriting that once nearly
// seeded thousands of fake accounts straight into it. Load-test scripts
// must be pointed at their database explicitly and it must obviously be a
// throwaway one.
export function resolveLoadTestUri() {
  const uri = process.env.LOADTEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/agriapp_loadtest';
  const dbNameMatch = uri.match(/\/([^/?]+)(\?|$)/);
  const dbName = dbNameMatch ? dbNameMatch[1] : '';
  if (!dbName.toLowerCase().includes('loadtest')) {
    throw new Error(
      `Refusing to run: resolved database name "${dbName}" doesn't contain "loadtest". ` +
      `Set LOADTEST_MONGODB_URI explicitly to a database whose name contains "loadtest" ` +
      `(e.g. mongodb://127.0.0.1:27017/agriapp_loadtest). This check exists because these ` +
      `scripts insert/delete data by the thousands and must never touch a real database.`
    );
  }
  return uri;
}
