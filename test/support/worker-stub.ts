// vitest-plugin (cloudflareTest) requires a real Worker entry-point to boot
// Miniflare, even though these tests only exercise lib/services/* against
// `env` directly and never receive an actual HTTP request. The real app's
// entry is `vinext/server/fetch-handler`, but vitest-plugin resolves `main`
// as a project-relative file path rather than a package export, so it can't
// be reused here. This stub stands in for it.
export default {
  fetch: () => new Response('not used in tests', { status: 404 }),
}
