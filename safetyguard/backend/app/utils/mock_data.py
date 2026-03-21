"""Deterministic mock findings and graphs for development when API keys are unavailable."""

from __future__ import annotations


def get_mock_findings() -> dict[str, list[dict]]:
    """Return 2–4 realistic findings per dimension for an AI-powered codebase."""
    return {
        "security": [
            {
                "id": "F-001",
                "dimension": "security",
                "title": "Hardcoded API key in config.py",
                "severity": "critical",
                "description": (
                    "An OpenAI API key is committed in source control, exposing production "
                    "credentials to anyone with repo access."
                ),
                "evidence": {
                    "file": "config.py",
                    "line": 42,
                    "snippet": "OPENAI_API_KEY = 'sk-abc123...'",
                },
                "suggested_fix": (
                    "Move secrets to environment variables or a secret manager; rotate the exposed key."
                ),
                "references": ["https://owasp.org/www-project-top-ten/"],
            },
            {
                "id": "F-002",
                "dimension": "security",
                "title": "SQL injection in user search",
                "severity": "high",
                "description": (
                    "User-supplied query text is interpolated into a raw SQL string without "
                    "parameterization."
                ),
                "evidence": {
                    "file": "app/db/queries.py",
                    "line": 88,
                    "snippet": 'cursor.execute(f"SELECT * FROM users WHERE name = \'{q}\'")',
                },
                "suggested_fix": "Use parameterized queries or an ORM with bound parameters.",
                "references": ["https://cwe.mitre.org/data/definitions/89.html"],
            },
            {
                "id": "F-003",
                "dimension": "security",
                "title": "Admin routes lack authentication",
                "severity": "high",
                "description": (
                    "Several /admin/* endpoints are registered without JWT or session checks."
                ),
                "evidence": {
                    "file": "app/routers/admin.py",
                    "line": 15,
                    "snippet": "@router.post('/admin/purge-cache')  # no Depends(get_current_user)",
                },
                "suggested_fix": "Require authenticated admin roles on all administrative routes.",
                "references": ["https://owasp.org/www-project-api-security/"],
            },
        ],
        "risk": [
            {
                "id": "F-010",
                "dimension": "risk",
                "title": "No rate limiting on LLM proxy",
                "severity": "high",
                "description": (
                    "The public /v1/chat/completions proxy accepts unbounded requests per IP, "
                    "enabling cost and abuse spikes."
                ),
                "evidence": {
                    "file": "app/routers/playground.py",
                    "line": 31,
                    "snippet": "@router.post('/v1/chat/completions')",
                },
                "suggested_fix": "Add per-key and per-IP rate limits and burst controls.",
                "references": ["https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html"],
            },
            {
                "id": "F-011",
                "dimension": "risk",
                "title": "Single OpenAI key for all tenants",
                "severity": "medium",
                "description": (
                    "All customers share one API key; a leak or revocation affects every tenant."
                ),
                "evidence": {
                    "file": "app/services/playground_service.py",
                    "line": 54,
                    "snippet": "client = OpenAI(api_key=settings.OPENAI_API_KEY)",
                },
                "suggested_fix": "Isolate credentials per tenant or use a broker with scoped keys.",
                "references": [],
            },
            {
                "id": "F-012",
                "dimension": "risk",
                "title": "No health check for embedding dependency",
                "severity": "low",
                "description": (
                    "Startup does not verify connectivity to the vector store; failures surface only at query time."
                ),
                "evidence": {
                    "file": "app/main.py",
                    "line": 20,
                    "snippet": "# TODO: vector health",
                },
                "suggested_fix": "Add readiness probes that validate embedding and vector DB connectivity.",
                "references": [],
            },
        ],
        "hallucinations": [
            {
                "id": "F-020",
                "dimension": "hallucinations",
                "title": "RAG answers without citation grounding",
                "severity": "high",
                "description": (
                    "The assistant synthesizes answers from retrieved chunks but does not attach "
                    "chunk IDs or source spans for verification."
                ),
                "evidence": {
                    "file": "app/services/repo_service.py",
                    "line": 120,
                    "snippet": "return ChatOpenAI(...).invoke(messages).content",
                },
                "suggested_fix": "Return citations (file, offset) and require grounding checks before display.",
                "references": ["https://arxiv.org/abs/2310.01352"],
            },
            {
                "id": "F-021",
                "dimension": "hallucinations",
                "title": "Missing confidence scores on completions",
                "severity": "medium",
                "description": (
                    "Responses are shown with uniform UI treatment; low-logprob answers are not flagged."
                ),
                "evidence": {
                    "file": "app/routers/playground.py",
                    "line": 48,
                    "snippet": "return {'content': text}",
                },
                "suggested_fix": "Surface logprobs or a calibrated confidence and gate high-stakes actions.",
                "references": [],
            },
            {
                "id": "F-022",
                "dimension": "hallucinations",
                "title": "No self-consistency or n-best sampling",
                "severity": "low",
                "description": (
                    "Single-sample generation is used for factual extraction from unstructured docs."
                ),
                "evidence": {
                    "file": "app/agents/repo_explorer.py",
                    "line": 200,
                    "snippet": "llm.invoke(...)",
                },
                "suggested_fix": "Use multiple samples or structured outputs for extraction tasks.",
                "references": [],
            },
        ],
        "failures": [
            {
                "id": "F-030",
                "dimension": "failures",
                "title": "No retry on transient OpenAI errors",
                "severity": "high",
                "description": (
                    "HTTP 429/5xx from the model provider bubble up as hard failures to the client."
                ),
                "evidence": {
                    "file": "app/services/playground_service.py",
                    "line": 72,
                    "snippet": "response = client.chat.completions.create(...)",
                },
                "suggested_fix": "Add exponential backoff with jitter and idempotency keys where applicable.",
                "references": ["https://platform.openai.com/docs/guides/error-codes"],
            },
            {
                "id": "F-031",
                "dimension": "failures",
                "title": "Downstream API calls lack circuit breaker",
                "severity": "medium",
                "description": (
                    "Repeated failures to the embeddings service continue to tie up worker threads."
                ),
                "evidence": {
                    "file": "app/services/repo_service.py",
                    "line": 45,
                    "snippet": "requests.post(EMBED_URL, json=payload, timeout=30)",
                },
                "suggested_fix": "Introduce a circuit breaker and fast-fail when the dependency is unhealthy.",
                "references": [],
            },
            {
                "id": "F-032",
                "dimension": "failures",
                "title": "Partial writes on report persistence",
                "severity": "medium",
                "description": (
                    "Report rows can be left inconsistent if filesystem upload succeeds but DB commit fails."
                ),
                "evidence": {
                    "file": "app/services/upload_service.py",
                    "line": 90,
                    "snippet": "save_file(...); db.add(report)",
                },
                "suggested_fix": "Use transactions spanning storage and DB or compensating cleanup.",
                "references": [],
            },
        ],
        "cost": [
            {
                "id": "F-040",
                "dimension": "cost",
                "title": "Unbounded max_tokens on chat route",
                "severity": "high",
                "description": (
                    "Clients may request extremely large completions without server-side caps."
                ),
                "evidence": {
                    "file": "app/schemas/run.py",
                    "line": 18,
                    "snippet": "max_tokens: int | None = None",
                },
                "suggested_fix": "Enforce a maximum max_tokens and default to a conservative value.",
                "references": [],
            },
            {
                "id": "F-041",
                "dimension": "cost",
                "title": "No caching of repeated embedding requests",
                "severity": "medium",
                "description": (
                    "Identical document chunks are re-embedded on every re-index run."
                ),
                "evidence": {
                    "file": "app/services/repo_service.py",
                    "line": 200,
                    "snippet": "embed_texts(chunks)",
                },
                "suggested_fix": "Cache embeddings keyed by content hash.",
                "references": [],
            },
            {
                "id": "F-042",
                "dimension": "cost",
                "title": "Verbose tool transcripts stored verbatim",
                "severity": "low",
                "description": (
                    "Full LangGraph message history is persisted, inflating storage for long runs."
                ),
                "evidence": {
                    "file": "app/models/run.py",
                    "line": 22,
                    "snippet": "transcript = Column(Text)",
                },
                "suggested_fix": "Store summarized transcripts or TTL old runs.",
                "references": [],
            },
        ],
        "privacy": [
            {
                "id": "F-050",
                "dimension": "privacy",
                "title": "PII logged in plaintext request logs",
                "severity": "critical",
                "description": (
                    "Email addresses and phone numbers from user prompts appear in application logs."
                ),
                "evidence": {
                    "file": "app/main.py",
                    "line": 35,
                    "snippet": "logger.info(f'request body: {body}')",
                },
                "suggested_fix": "Redact PII in logs or avoid logging raw bodies in production.",
                "references": ["https://gdpr.eu/what-is-personal-data/"],
            },
            {
                "id": "F-051",
                "dimension": "privacy",
                "title": "No data retention policy for uploaded repos",
                "severity": "high",
                "description": (
                    "Uploaded archives remain on disk indefinitely after analysis completes."
                ),
                "evidence": {
                    "file": "app/services/upload_service.py",
                    "line": 10,
                    "snippet": "UPLOAD_DIR",
                },
                "suggested_fix": "Define retention windows and automated deletion jobs.",
                "references": [],
            },
            {
                "id": "F-052",
                "dimension": "privacy",
                "title": "Telemetry may include raw prompts",
                "severity": "medium",
                "description": (
                    "Error reporting attaches the last user message without scrubbing secrets."
                ),
                "evidence": {
                    "file": "app/services/simulator_service.py",
                    "line": 60,
                    "snippet": "sentry_sdk.capture_exception(extra={'prompt': prompt})",
                },
                "suggested_fix": "Scrub prompts in telemetry or hash sensitive segments.",
                "references": [],
            },
        ],
        "observability": [
            {
                "id": "F-060",
                "dimension": "observability",
                "title": "Unstructured logging only",
                "severity": "medium",
                "description": (
                    "Logs are plain strings, making it hard to query latency or error rates in a log platform."
                ),
                "evidence": {
                    "file": "app/routers/runs.py",
                    "line": 25,
                    "snippet": "print('run started', run_id)",
                },
                "suggested_fix": "Use structured JSON logging with consistent fields (run_id, latency_ms, etc.).",
                "references": [],
            },
            {
                "id": "F-061",
                "dimension": "observability",
                "title": "No distributed tracing for LLM spans",
                "severity": "medium",
                "description": (
                    "OpenAI calls are not wrapped in trace spans, so bottlenecks are invisible in APM."
                ),
                "evidence": {
                    "file": "app/services/playground_service.py",
                    "line": 70,
                    "snippet": "client.chat.completions.create",
                },
                "suggested_fix": "Instrument model calls with OpenTelemetry spans and propagate context.",
                "references": ["https://opentelemetry.io/docs/"],
            },
            {
                "id": "F-062",
                "dimension": "observability",
                "title": "Missing SLO dashboards for async workers",
                "severity": "low",
                "description": (
                    "Background report jobs have no queue depth or age metrics exposed."
                ),
                "evidence": {
                    "file": "app/routers/reports.py",
                    "line": 1,
                    "snippet": "# no metrics",
                },
                "suggested_fix": "Export queue lag and job duration histograms.",
                "references": [],
            },
        ],
        "performance": [
            {
                "id": "F-070",
                "dimension": "performance",
                "title": "Synchronous LLM calls in request thread",
                "severity": "high",
                "description": (
                    "The FastAPI handler blocks the worker until the full completion returns."
                ),
                "evidence": {
                    "file": "app/routers/playground.py",
                    "line": 40,
                    "snippet": "result = service.chat_sync(...)",
                },
                "suggested_fix": "Use async clients or offload to a worker with streaming responses.",
                "references": [],
            },
            {
                "id": "F-071",
                "dimension": "performance",
                "title": "No streaming to clients",
                "severity": "medium",
                "description": (
                    "Users wait for the entire model output before any tokens are flushed."
                ),
                "evidence": {
                    "file": "app/services/playground_service.py",
                    "line": 75,
                    "snippet": "stream=False",
                },
                "suggested_fix": "Enable SSE/WebSocket streaming for long generations.",
                "references": [],
            },
            {
                "id": "F-072",
                "dimension": "performance",
                "title": "Large repo scans read files repeatedly",
                "severity": "low",
                "description": (
                    "The explorer re-reads the same paths across tool calls without memoization."
                ),
                "evidence": {
                    "file": "app/utils/file_tools.py",
                    "line": 1,
                    "snippet": "def read_file",
                },
                "suggested_fix": "Cache file contents keyed by path within a run.",
                "references": [],
            },
        ],
        "resources": [
            {
                "id": "F-080",
                "dimension": "resources",
                "title": "Database connections created per request",
                "severity": "medium",
                "description": (
                    "Each API call opens a new DB connection instead of using a pool."
                ),
                "evidence": {
                    "file": "app/database.py",
                    "line": 15,
                    "snippet": "create_engine(..., poolclass=NullPool)",
                },
                "suggested_fix": "Use connection pooling appropriate to deployment size.",
                "references": [],
            },
            {
                "id": "F-081",
                "dimension": "resources",
                "title": "No memory limits on in-memory chunk buffers",
                "severity": "medium",
                "description": (
                    "Indexing loads all chunks into RAM before batching embeddings."
                ),
                "evidence": {
                    "file": "app/services/repo_service.py",
                    "line": 150,
                    "snippet": "chunks = list(read_all_chunks(repo_path))",
                },
                "suggested_fix": "Stream batches with backpressure and cap resident memory.",
                "references": [],
            },
            {
                "id": "F-082",
                "dimension": "resources",
                "title": "Unbounded thread pool for CPU work",
                "severity": "low",
                "description": (
                    "ThreadPoolExecutor is created with default max_workers for every request."
                ),
                "evidence": {
                    "file": "app/services/simulator_service.py",
                    "line": 30,
                    "snippet": "ThreadPoolExecutor()",
                },
                "suggested_fix": "Use a shared executor with fixed size or process pool for CPU-heavy tasks.",
                "references": [],
            },
        ],
        "redteam": [
            {
                "id": "F-090",
                "dimension": "redteam",
                "title": "Prompt injection via retrieved documents",
                "severity": "critical",
                "description": (
                    "Malicious content in an uploaded repo can instruct the model to exfiltrate secrets."
                ),
                "evidence": {
                    "file": "app/agents/repo_explorer.py",
                    "line": 24,
                    "snippet": "SystemMessage(content=_EXPLORER_SYSTEM)",
                },
                "suggested_fix": "Sandbox tool outputs, separate system from untrusted data, and use allowlists.",
                "references": ["https://genai.owasp.org/llmrisk/llm01-prompt-injection/"],
            },
            {
                "id": "F-091",
                "dimension": "redteam",
                "title": "System prompt leakage in error messages",
                "severity": "high",
                "description": (
                    "Stack traces include the full system prompt when JSON parsing fails."
                ),
                "evidence": {
                    "file": "app/agents/repo_explorer.py",
                    "line": 180,
                    "snippet": "raise ValueError(f'parse error: {text}')",
                },
                "suggested_fix": "Sanitize exceptions returned to clients; log details server-side only.",
                "references": [],
            },
            {
                "id": "F-092",
                "dimension": "redteam",
                "title": "Jailbreak-style overrides accepted in user role",
                "severity": "medium",
                "description": (
                    "User messages beginning with 'Ignore previous instructions' are passed through unchanged."
                ),
                "evidence": {
                    "file": "app/services/playground_service.py",
                    "line": 65,
                    "snippet": "messages.append({'role': 'user', 'content': user_text})",
                },
                "suggested_fix": "Add policy classifiers or instruction hierarchy defenses for untrusted input.",
                "references": [],
            },
        ],
    }


def get_mock_dependency_graph() -> dict:
    """A small realistic graph for an AI API + worker + data plane."""
    return {
        "nodes": [
            {"id": "gw", "label": "API Gateway", "type": "api"},
            {"id": "orch", "label": "Agent Orchestrator", "type": "llm"},
            {"id": "openai", "label": "OpenAI API", "type": "external"},
            {"id": "pg", "label": "PostgreSQL", "type": "database"},
            {"id": "redis", "label": "Redis", "type": "database"},
            {"id": "q", "label": "Report Jobs Queue", "type": "queue"},
            {"id": "worker", "label": "Report Worker", "type": "api"},
            {"id": "vec", "label": "Vector Store", "type": "external"},
        ],
        "edges": [
            {"source": "gw", "target": "orch", "relation": "http"},
            {"source": "orch", "target": "openai", "relation": "llm_call"},
            {"source": "orch", "target": "pg", "relation": "read_write"},
            {"source": "orch", "target": "redis", "relation": "cache"},
            {"source": "orch", "target": "q", "relation": "enqueue"},
            {"source": "q", "target": "worker", "relation": "dequeue"},
            {"source": "worker", "target": "pg", "relation": "persist_report"},
            {"source": "worker", "target": "vec", "relation": "embed_query"},
            {"source": "worker", "target": "openai", "relation": "summarize"},
        ],
    }
