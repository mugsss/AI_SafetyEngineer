"""Rule-based static code analyzers for each SafetyGuard dimension.

Each ``scan_<dimension>(repo_path)`` function walks the repository, applies
regex patterns, and returns a list of findings in the standard schema so that
agents always produce useful results — even without an LLM.
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

# ── helpers ──────────────────────────────────────────────────────────────────

EXCLUDED_DIRS = {
    ".git", "node_modules", "__pycache__", "dist", "build",
    ".next", ".venv", "venv", "env", ".egg-info", ".tox",
    "htmlcov", ".mypy_cache", ".pytest_cache",
}
EXCLUDED_EXTENSIONS = {".lock", ".pyc", ".pyo", ".so", ".dylib", ".whl", ".egg", ".png", ".jpg", ".ico", ".svg"}

_CODE_EXTENSIONS = {
    ".py", ".js", ".ts", ".tsx", ".jsx", ".go", ".rs", ".java",
    ".rb", ".php", ".yaml", ".yml", ".toml", ".json", ".env",
    ".sh", ".bash", ".dockerfile",
}

_id_counter: int = 0


def _next_id() -> str:
    global _id_counter
    _id_counter += 1
    return f"SA-{_id_counter:03d}"


def _reset_ids() -> None:
    global _id_counter
    _id_counter = 0


def _should_skip(name: str, is_dir: bool) -> bool:
    if is_dir:
        return name in EXCLUDED_DIRS
    _, ext = os.path.splitext(name)
    return ext in EXCLUDED_EXTENSIONS


_MAX_FILES = 1000
_file_cache: dict[str, list[tuple[str, str]]] = {}


def _walk_code_files(repo_path: str) -> list[tuple[str, str]]:
    """Return list of (relative_path, content) for source files, cached per repo_path."""
    norm = os.path.normpath(repo_path)
    if norm in _file_cache:
        return _file_cache[norm]

    files: list[tuple[str, str]] = []
    for root, dirs, filenames in os.walk(repo_path):
        dirs[:] = sorted(d for d in dirs if not _should_skip(d, True))
        for fname in sorted(filenames):
            if _should_skip(fname, False):
                continue
            ext = os.path.splitext(fname)[1].lower()
            if ext not in _CODE_EXTENSIONS:
                continue
            full = os.path.join(root, fname)
            rel = os.path.relpath(full, repo_path).replace("\\", "/")
            try:
                with open(full, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read(50_000)
                files.append((rel, content))
            except Exception:
                continue
            if len(files) >= _MAX_FILES:
                break
        if len(files) >= _MAX_FILES:
            break

    _file_cache[norm] = files
    return files


def _finding(
    dimension: str,
    title: str,
    severity: str,
    description: str,
    file: str,
    line: int,
    snippet: str,
    suggested_fix: str,
) -> dict[str, Any]:
    return {
        "id": _next_id(),
        "dimension": dimension,
        "title": title,
        "severity": severity,
        "description": description,
        "evidence": {"file": file, "line": line, "snippet": snippet[:200]},
        "suggested_fix": suggested_fix,
    }


def _scan_lines(
    content: str, pattern: re.Pattern, *, limit: int = 5
) -> list[tuple[int, str]]:
    """Return up to *limit* (1-based line number, stripped line) matches."""
    hits: list[tuple[int, str]] = []
    for i, line in enumerate(content.splitlines(), 1):
        if pattern.search(line):
            hits.append((i, line.strip()[:200]))
            if len(hits) >= limit:
                break
    return hits


# ── Security ─────────────────────────────────────────────────────────────────

_SECRET_PATTERNS = [
    (re.compile(r"""(?:api[_-]?key|secret|password|token|auth)\s*[:=]\s*['"][A-Za-z0-9_\-/.]{8,}['"]""", re.I),
     "Hardcoded secret or credential"),
    (re.compile(r"""sk-[A-Za-z0-9]{20,}"""),
     "OpenAI-style API key in source"),
    (re.compile(r"""AKIA[0-9A-Z]{16}"""),
     "AWS access key ID in source"),
    (re.compile(r"""ghp_[A-Za-z0-9]{30,}"""),
     "GitHub personal access token in source"),
]

_SECURITY_RULES: list[tuple[re.Pattern, str, str, str, str]] = [
    # pattern, title, severity, description, suggested_fix
    (re.compile(r"""\beval\s*\(""", re.I),
     "Use of eval()", "critical",
     "eval() executes arbitrary code and is a primary injection vector.",
     "Replace eval() with a safe parser (ast.literal_eval, JSON.parse, etc.)."),
    (re.compile(r"""\bexec\s*\(""", re.I),
     "Use of exec()", "critical",
     "exec() runs arbitrary code strings — extremely dangerous with user input.",
     "Remove exec() and use structured dispatch or safe alternatives."),
    (re.compile(r"""subprocess\..*shell\s*=\s*True""", re.I),
     "Shell injection risk via subprocess", "high",
     "subprocess with shell=True allows command injection when input is user-controlled.",
     "Use shell=False and pass arguments as a list."),
    (re.compile(r"""cursor\.execute\s*\(\s*f['"]""", re.I),
     "SQL injection via f-string in query", "critical",
     "User input interpolated directly into SQL enables injection attacks.",
     "Use parameterized queries (cursor.execute('...?', (param,)))."),
    (re.compile(r"""\.execute\s*\(\s*['"].*%s""", re.I),
     "Potential SQL injection via string formatting", "high",
     "String formatting in SQL queries risks injection if inputs are not sanitized.",
     "Use parameterized queries with bound variables."),
    (re.compile(r"""\bpickle\.loads?\b""", re.I),
     "Unsafe deserialization with pickle", "high",
     "pickle.load on untrusted data enables arbitrary code execution.",
     "Use JSON or a safe serialization format for untrusted data."),
    (re.compile(r"""yaml\.load\s*\([^)]*\)(?!.*Loader)""", re.I),
     "Unsafe YAML loading", "high",
     "yaml.load without a SafeLoader can execute arbitrary Python objects.",
     "Use yaml.safe_load() or pass Loader=yaml.SafeLoader."),
    (re.compile(r"""app\.run\s*\(.*debug\s*=\s*True""", re.I),
     "Debug mode enabled in production", "medium",
     "Debug mode exposes stack traces and may enable code execution in Flask/Django.",
     "Disable debug mode in production deployments."),
    (re.compile(r"""CORS\s*\(.*allow_origins\s*=\s*\[?\s*['"]\*['"]\s*\]?""", re.I),
     "Wildcard CORS origin", "medium",
     "Allowing all origins opens the API to cross-site request forgery from any domain.",
     "Restrict CORS to known frontend origins."),
    (re.compile(r"""verify\s*=\s*False""", re.I),
     "TLS verification disabled", "high",
     "Skipping TLS certificate verification enables man-in-the-middle attacks.",
     "Remove verify=False; use proper CA bundles."),
]


def scan_security(repo_path: str) -> list[dict]:
    findings: list[dict] = []
    files = _walk_code_files(repo_path)
    for rel, content in files:
        if rel.endswith((".env", ".env.local", ".env.production")):
            continue
        for pat, label in _SECRET_PATTERNS:
            for lineno, snippet in _scan_lines(content, pat, limit=2):
                if ".example" in rel or ".sample" in rel:
                    continue
                findings.append(_finding(
                    "security", label, "critical",
                    f"Possible hardcoded credential found in {rel}.",
                    rel, lineno, snippet,
                    "Move secrets to environment variables or a secret manager and rotate the exposed value.",
                ))
        for pat, title, sev, desc, fix in _SECURITY_RULES:
            for lineno, snippet in _scan_lines(content, pat, limit=2):
                findings.append(_finding("security", title, sev, desc, rel, lineno, snippet, fix))
    return findings


# ── Hallucinations ───────────────────────────────────────────────────────────

def scan_hallucinations(repo_path: str) -> list[dict]:
    findings: list[dict] = []
    files = _walk_code_files(repo_path)

    has_llm_call = False
    has_grounding = False
    has_confidence = False
    has_citation = False
    has_structured_output = False

    llm_call_patterns = re.compile(
        r"""(?:ChatOpenAI|OpenAI|ChatCompletion|\.invoke|\.ainvoke|\.chat\.completions\.create|ChatAnthropic|langchain)""", re.I
    )
    grounding_patterns = re.compile(
        r"""(?:ground|retriev|rag|vector.*search|similarity_search|source.*attribution|fact.?check)""", re.I
    )
    confidence_patterns = re.compile(
        r"""(?:confidence|logprob|calibrat|uncertain|score.*threshold)""", re.I
    )
    citation_patterns = re.compile(
        r"""(?:citation|source_?id|chunk_?id|reference.*url|provenance)""", re.I
    )
    structured_patterns = re.compile(
        r"""(?:structured_output|with_structured_output|response_format|json_schema|Pydantic.*model)""", re.I
    )

    llm_file = ""
    llm_line = 0
    llm_snippet = ""

    for rel, content in files:
        if llm_call_patterns.search(content):
            has_llm_call = True
            if not llm_file:
                hits = _scan_lines(content, llm_call_patterns, limit=1)
                if hits:
                    llm_file = rel
                    llm_line = hits[0][0]
                    llm_snippet = hits[0][1]
        if grounding_patterns.search(content):
            has_grounding = True
        if confidence_patterns.search(content):
            has_confidence = True
        if citation_patterns.search(content):
            has_citation = True
        if structured_patterns.search(content):
            has_structured_output = True

    if not llm_file:
        llm_file = "(project root)"

    if has_llm_call and not has_grounding:
        findings.append(_finding(
            "hallucinations",
            "LLM outputs lack grounding or retrieval verification",
            "high",
            "The codebase invokes LLM completions but has no retrieval-augmented grounding "
            "or fact-checking mechanism, increasing hallucination risk.",
            llm_file, llm_line, llm_snippet,
            "Add retrieval-augmented generation (RAG) with source verification, or "
            "validate LLM outputs against a knowledge base before returning them to users.",
        ))

    if has_llm_call and not has_citation:
        findings.append(_finding(
            "hallucinations",
            "No source citation or provenance tracking",
            "medium",
            "LLM responses are returned to users without citing the source documents "
            "or data they were derived from, making it impossible to verify accuracy.",
            llm_file, llm_line, llm_snippet,
            "Include source citations (file, chunk ID, or URL) with each LLM response "
            "so users can verify claims.",
        ))

    if has_llm_call and not has_confidence:
        findings.append(_finding(
            "hallucinations",
            "No confidence scoring on model outputs",
            "medium",
            "Model responses are presented uniformly without indicating confidence levels. "
            "Low-confidence answers could be treated as authoritative.",
            llm_file, llm_line, llm_snippet,
            "Surface logprobs or implement a calibrated confidence score; gate high-stakes "
            "actions on confidence thresholds.",
        ))

    if has_llm_call and not has_structured_output:
        findings.append(_finding(
            "hallucinations",
            "No structured output enforcement for LLM responses",
            "low",
            "LLM responses are consumed as free-form text without schema validation, "
            "increasing the chance of malformed or fabricated data passing through.",
            llm_file, llm_line, llm_snippet,
            "Use structured output modes (JSON schema, Pydantic models, tool calling) "
            "to constrain and validate LLM outputs.",
        ))

    # Check for prompt templates that lack grounding instructions
    prompt_pat = re.compile(r"""(?:system_prompt|SYSTEM_PROMPT|system_message|SystemMessage)""")
    ground_instruction = re.compile(r"""(?:only.*(?:provided|retrieved|given)|do not (?:make up|invent|fabricate)|based (?:on|solely))""", re.I)
    for rel, content in files:
        if prompt_pat.search(content) and not ground_instruction.search(content):
            hits = _scan_lines(content, prompt_pat, limit=1)
            if hits:
                findings.append(_finding(
                    "hallucinations",
                    "System prompt lacks grounding instructions",
                    "medium",
                    f"A system prompt in {rel} does not instruct the model to only use "
                    "provided context or refuse when evidence is missing.",
                    rel, hits[0][0], hits[0][1],
                    "Add instructions like 'Only answer based on the provided context. "
                    "If the answer is not in the context, say you don't know.'",
                ))

    return findings


# ── Risk ─────────────────────────────────────────────────────────────────────

def scan_risk(repo_path: str) -> list[dict]:
    findings: list[dict] = []
    files = _walk_code_files(repo_path)

    has_rate_limit = False
    has_health_check = False
    has_input_validation = False
    api_file = ""
    api_line = 0
    api_snippet = ""

    rate_limit_pat = re.compile(r"""(?:rate.?limit|throttl|slowapi|RateLimiter|leaky.?bucket|token.?bucket)""", re.I)
    health_pat = re.compile(r"""(?:/health|/readiness|/liveness|health.?check|readiness.?probe)""", re.I)
    validation_pat = re.compile(r"""(?:Pydantic|BaseModel|validator|Field\(|Schema\(|Joi\.|zod\.|yup\.)""", re.I)
    api_route_pat = re.compile(r"""(?:@(?:app|router)\.(?:get|post|put|delete|patch)|@api_view|app\.use)""", re.I)

    for rel, content in files:
        if rate_limit_pat.search(content):
            has_rate_limit = True
        if health_pat.search(content):
            has_health_check = True
        if validation_pat.search(content):
            has_input_validation = True
        if api_route_pat.search(content) and not api_file:
            hits = _scan_lines(content, api_route_pat, limit=1)
            if hits:
                api_file = rel
                api_line = hits[0][0]
                api_snippet = hits[0][1]

    if not api_file:
        api_file = "(project root)"

    if not has_rate_limit:
        findings.append(_finding(
            "risk", "No rate limiting detected", "high",
            "The application does not appear to have any rate-limiting middleware, "
            "leaving it vulnerable to abuse, cost spikes, and denial-of-service.",
            api_file, api_line, api_snippet,
            "Add per-IP and per-key rate limiting (e.g., SlowAPI, express-rate-limit).",
        ))

    if not has_health_check:
        findings.append(_finding(
            "risk", "No health check endpoints", "medium",
            "No /health or readiness probe was found. Orchestrators and load balancers "
            "cannot determine if the service is healthy.",
            api_file, 0, "",
            "Add /health and /readiness endpoints that verify database and LLM connectivity.",
        ))

    if not has_input_validation:
        findings.append(_finding(
            "risk", "No input validation framework detected", "medium",
            "No Pydantic, Joi, Zod, or similar validation library usage was found. "
            "Unvalidated user inputs increase attack surface.",
            api_file, 0, "",
            "Use a validation library to enforce schemas on all API inputs.",
        ))

    # Single API key for external services
    single_key_pat = re.compile(r"""(?:OPENAI_API_KEY|FEATHERLESS_API_KEY|ANTHROPIC_API_KEY)\s*[:=]""", re.I)
    for rel, content in files:
        hits = _scan_lines(content, single_key_pat, limit=1)
        if hits and "per.?tenant" not in content.lower() and "per.?user" not in content.lower():
            findings.append(_finding(
                "risk", "Single shared API key for all users", "medium",
                "A single LLM provider API key is shared across all requests. "
                "A leak or revocation would affect every user simultaneously.",
                rel, hits[0][0], hits[0][1],
                "Isolate API keys per tenant or use a broker with scoped credentials.",
            ))
            break

    return findings


# ── Failures ─────────────────────────────────────────────────────────────────

def scan_failures(repo_path: str) -> list[dict]:
    findings: list[dict] = []
    files = _walk_code_files(repo_path)

    has_retry = False
    has_circuit_breaker = False
    has_timeout = False
    has_error_handling = False

    retry_pat = re.compile(r"""(?:retry|tenacity|backoff|Retry|retries|max_retries)""", re.I)
    circuit_pat = re.compile(r"""(?:circuit.?breaker|CircuitBreaker|pybreaker|opossum)""", re.I)
    timeout_pat = re.compile(r"""(?:timeout\s*[:=]\s*\d|connect_timeout|read_timeout|request_timeout)""", re.I)

    http_call_pat = re.compile(r"""(?:requests\.(?:get|post|put|delete|patch)|httpx\.|aiohttp\.|fetch\(|axios\.)""", re.I)
    http_file = ""
    http_line = 0
    http_snippet = ""

    bare_except_pat = re.compile(r"""^\s*except\s*:""")
    pass_except_pat = re.compile(r"""except.*:\s*(?:pass|\.\.\.)\s*$""")

    for rel, content in files:
        if retry_pat.search(content):
            has_retry = True
        if circuit_pat.search(content):
            has_circuit_breaker = True
        if timeout_pat.search(content):
            has_timeout = True
        if re.search(r"""(?:try\s*:|\.catch\s*\()""", content):
            has_error_handling = True

        if http_call_pat.search(content) and not http_file:
            hits = _scan_lines(content, http_call_pat, limit=1)
            if hits:
                http_file = rel
                http_line = hits[0][0]
                http_snippet = hits[0][1]

        for lineno, snippet in _scan_lines(content, bare_except_pat, limit=3):
            findings.append(_finding(
                "failures", "Bare except clause swallows all errors", "medium",
                "A bare except: catches SystemExit, KeyboardInterrupt, and all exceptions "
                "indiscriminately, hiding real failures.",
                rel, lineno, snippet,
                "Catch specific exception types (e.g., except ValueError:).",
            ))

        for lineno, snippet in _scan_lines(content, pass_except_pat, limit=3):
            findings.append(_finding(
                "failures", "Exception silently swallowed with pass", "medium",
                "An except block uses pass/..., silently discarding the error. "
                "This hides failures and makes debugging extremely difficult.",
                rel, lineno, snippet,
                "Log the exception at minimum; consider re-raising or returning an error response.",
            ))

    if not http_file:
        http_file = "(project root)"

    if not has_retry:
        findings.append(_finding(
            "failures", "No retry mechanism for external calls", "high",
            "No retry/backoff library (tenacity, backoff) or retry pattern was detected. "
            "Transient failures from LLM providers or APIs will cause hard failures.",
            http_file, http_line, http_snippet,
            "Add exponential backoff with jitter for transient errors (429, 5xx).",
        ))

    if not has_circuit_breaker:
        findings.append(_finding(
            "failures", "No circuit breaker pattern", "medium",
            "No circuit breaker library or pattern was detected. Repeated failures "
            "to a dependency will continue consuming resources.",
            http_file, http_line, http_snippet,
            "Add a circuit breaker (e.g., pybreaker, opossum) around external service calls.",
        ))

    if not has_timeout and http_file != "(project root)":
        findings.append(_finding(
            "failures", "HTTP calls may lack explicit timeouts", "medium",
            "External HTTP calls were found without visible timeout configuration. "
            "Calls can hang indefinitely, blocking workers.",
            http_file, http_line, http_snippet,
            "Set explicit timeouts on all HTTP client calls (e.g., timeout=30).",
        ))

    return findings


# ── Cost ─────────────────────────────────────────────────────────────────────

def scan_cost(repo_path: str) -> list[dict]:
    findings: list[dict] = []
    files = _walk_code_files(repo_path)

    has_token_limit = False
    has_caching = False
    has_streaming = False

    token_pat = re.compile(r"""(?:max_tokens\s*[:=]\s*\d|token_limit|max_completion)""", re.I)
    cache_pat = re.compile(r"""(?:@cache|lru_cache|redis\.get|Cache\(|memo|cached)""", re.I)
    stream_pat = re.compile(r"""(?:stream\s*[:=]\s*True|StreamingResponse|EventSource|SSE)""", re.I)

    llm_call_pat = re.compile(r"""(?:ChatOpenAI|completions\.create|\.invoke|\.ainvoke)""", re.I)
    llm_file = ""
    llm_line = 0
    llm_snippet = ""

    for rel, content in files:
        if token_pat.search(content):
            has_token_limit = True
        if cache_pat.search(content):
            has_caching = True
        if stream_pat.search(content):
            has_streaming = True
        if llm_call_pat.search(content) and not llm_file:
            hits = _scan_lines(content, llm_call_pat, limit=1)
            if hits:
                llm_file = rel
                llm_line = hits[0][0]
                llm_snippet = hits[0][1]

    if not llm_file:
        llm_file = "(project root)"

    if not has_token_limit:
        findings.append(_finding(
            "cost", "No max_tokens limit on LLM calls", "high",
            "LLM invocations do not set max_tokens, allowing unbounded completions "
            "that drive up API costs.",
            llm_file, llm_line, llm_snippet,
            "Set a reasonable max_tokens default and enforce server-side caps.",
        ))

    if not has_caching:
        findings.append(_finding(
            "cost", "No caching layer for repeated requests", "medium",
            "No caching mechanism (Redis, lru_cache, memoization) was detected. "
            "Identical requests to the LLM provider will be billed repeatedly.",
            llm_file, llm_line, llm_snippet,
            "Cache LLM responses keyed by (prompt hash, model, temperature) with a TTL.",
        ))

    # Large context in prompts
    large_context_pat = re.compile(r"""(?:\.read\(\)|readlines\(\)|read_file|f\.read\(\s*\))""")
    for rel, content in files:
        if llm_call_pat.search(content) and large_context_pat.search(content):
            hits = _scan_lines(content, large_context_pat, limit=1)
            if hits:
                findings.append(_finding(
                    "cost", "Full file content may be passed to LLM without truncation", "medium",
                    "Files are read in full and potentially sent as LLM context without "
                    "summarization or chunking, inflating token usage.",
                    rel, hits[0][0], hits[0][1],
                    "Chunk or summarize large documents before including them in LLM prompts.",
                ))
                break

    return findings


# ── Privacy ──────────────────────────────────────────────────────────────────

def scan_privacy(repo_path: str) -> list[dict]:
    findings: list[dict] = []
    files = _walk_code_files(repo_path)

    has_pii_redaction = False

    redaction_pat = re.compile(r"""(?:redact|anonymize|mask|scrub|sanitize.*pii)""", re.I)
    log_body_pat = re.compile(r"""(?:log(?:ger)?\.(?:info|debug|warning|error)\s*\(.*(?:body|request|payload|prompt|message))""", re.I)
    print_body_pat = re.compile(r"""(?:print\s*\(.*(?:body|request|payload|prompt|password|token))""", re.I)
    pii_pat = re.compile(r"""(?:email|phone|ssn|social.?security|credit.?card|password|dob|date.?of.?birth|address)""", re.I)
    retention_pat = re.compile(r"""(?:retention|ttl|expire|cleanup|purge|delete.*after|auto.?delete)""", re.I)

    has_retention = False

    for rel, content in files:
        if redaction_pat.search(content):
            has_pii_redaction = True
        if retention_pat.search(content):
            has_retention = True

        for lineno, snippet in _scan_lines(content, log_body_pat, limit=2):
            findings.append(_finding(
                "privacy", "Request/prompt body logged in application logs", "high",
                "User prompts or request bodies are logged, potentially exposing PII, "
                "secrets, or sensitive content to log aggregators.",
                rel, lineno, snippet,
                "Redact sensitive fields before logging, or avoid logging raw request bodies.",
            ))

        for lineno, snippet in _scan_lines(content, print_body_pat, limit=2):
            findings.append(_finding(
                "privacy", "Sensitive data printed to stdout", "medium",
                "print() statements output user data to stdout where it may be captured "
                "by container log drivers without redaction.",
                rel, lineno, snippet,
                "Replace print() with structured logging and redact sensitive fields.",
            ))

    if not has_pii_redaction:
        found_pii_handling = False
        for rel, content in files:
            if pii_pat.search(content):
                found_pii_handling = True
                break
        if found_pii_handling:
            findings.append(_finding(
                "privacy", "PII fields handled without redaction utilities", "medium",
                "The codebase references PII fields (email, phone, etc.) but no redaction "
                "or anonymization utility was found.",
                "(project root)", 0, "",
                "Add a PII redaction layer that scrubs sensitive fields before logging, "
                "analytics, or external API calls.",
            ))

    if not has_retention:
        findings.append(_finding(
            "privacy", "No data retention or cleanup policy", "medium",
            "No retention policy, TTL, or automated cleanup mechanism was found. "
            "User data and uploaded files may persist indefinitely.",
            "(project root)", 0, "",
            "Define data retention windows and implement automated deletion for "
            "uploaded files, logs, and user data.",
        ))

    return findings


# ── Observability ────────────────────────────────────────────────────────────

def scan_observability(repo_path: str) -> list[dict]:
    findings: list[dict] = []
    files = _walk_code_files(repo_path)

    has_structured_logging = False
    has_tracing = False
    has_metrics = False
    has_print_logging = False
    print_file = ""
    print_line = 0
    print_snippet = ""

    structured_log_pat = re.compile(r"""(?:structlog|json.?log|logging\.config|JsonFormatter|pythonjsonlogger)""", re.I)
    tracing_pat = re.compile(r"""(?:opentelemetry|otel|jaeger|zipkin|trace\.start|@traced|DatadogTrace|newrelic)""", re.I)
    metrics_pat = re.compile(r"""(?:prometheus|statsd|metrics\.|Counter\(|Histogram\(|Gauge\(|datadog\.metrics)""", re.I)
    print_pat = re.compile(r"""^\s*print\s*\(""")

    for rel, content in files:
        if structured_log_pat.search(content):
            has_structured_logging = True
        if tracing_pat.search(content):
            has_tracing = True
        if metrics_pat.search(content):
            has_metrics = True
        if not has_print_logging:
            hits = _scan_lines(content, print_pat, limit=1)
            if hits:
                has_print_logging = True
                print_file = rel
                print_line = hits[0][0]
                print_snippet = hits[0][1]

    if has_print_logging:
        findings.append(_finding(
            "observability", "print() used instead of structured logging", "medium",
            "print() statements lack log levels, timestamps, and structured fields, "
            "making it hard to search, filter, or alert on log data.",
            print_file, print_line, print_snippet,
            "Replace print() with the logging module or structlog with JSON formatting.",
        ))

    if not has_structured_logging:
        findings.append(_finding(
            "observability", "No structured logging framework detected", "medium",
            "No structured/JSON logging library was found. Plain-text logs are difficult "
            "to query in log aggregation platforms.",
            "(project root)", 0, "",
            "Adopt structlog or python-json-logger for structured JSON log output.",
        ))

    if not has_tracing:
        findings.append(_finding(
            "observability", "No distributed tracing instrumentation", "medium",
            "No OpenTelemetry, Jaeger, or Datadog tracing library was detected. "
            "LLM call latency and inter-service flows are invisible.",
            "(project root)", 0, "",
            "Instrument with OpenTelemetry and wrap LLM calls in trace spans.",
        ))

    if not has_metrics:
        findings.append(_finding(
            "observability", "No application metrics exported", "low",
            "No Prometheus, StatsD, or metrics library was detected. "
            "Request rates, error rates, and latency distributions are not tracked.",
            "(project root)", 0, "",
            "Export key metrics (request rate, error rate, latency P50/P99) via Prometheus or similar.",
        ))

    return findings


# ── Performance ──────────────────────────────────────────────────────────────

def scan_performance(repo_path: str) -> list[dict]:
    findings: list[dict] = []
    files = _walk_code_files(repo_path)

    sync_in_async_pat = re.compile(r"""(?:(?:async\s+def)[\s\S]{0,500}(?:requests\.(?:get|post)|time\.sleep|open\())""", re.S)
    blocking_pat = re.compile(r"""(?:time\.sleep\s*\()""")
    no_streaming_pat = re.compile(r"""stream\s*[:=]\s*False""", re.I)

    for rel, content in files:
        if "async def" in content:
            for lineno, snippet in _scan_lines(content, blocking_pat, limit=2):
                findings.append(_finding(
                    "performance", "Blocking time.sleep() in async context", "medium",
                    "time.sleep() blocks the event loop in async code, stalling all "
                    "concurrent requests on the same worker.",
                    rel, lineno, snippet,
                    "Use asyncio.sleep() instead of time.sleep() in async functions.",
                ))

        for lineno, snippet in _scan_lines(content, no_streaming_pat, limit=1):
            findings.append(_finding(
                "performance", "LLM streaming explicitly disabled", "medium",
                "stream=False means the entire completion must finish before any "
                "tokens reach the user, increasing perceived latency.",
                rel, lineno, snippet,
                "Enable streaming (stream=True) and use SSE or WebSockets to flush tokens incrementally.",
            ))

    # Check for synchronous requests in async codebase
    sync_http_pat = re.compile(r"""requests\.(?:get|post|put|delete|patch)\s*\(""")
    async_file_pat = re.compile(r"""async\s+def""")
    for rel, content in files:
        if async_file_pat.search(content) and sync_http_pat.search(content):
            hits = _scan_lines(content, sync_http_pat, limit=1)
            if hits:
                findings.append(_finding(
                    "performance",
                    "Synchronous requests library used in async codebase",
                    "high",
                    "The synchronous 'requests' library blocks the event loop. "
                    "Use an async HTTP client instead.",
                    rel, hits[0][0], hits[0][1],
                    "Replace 'requests' with 'httpx.AsyncClient' or 'aiohttp.ClientSession'.",
                ))
                break

    return findings


# ── Resources ────────────────────────────────────────────────────────────────

def scan_resources(repo_path: str) -> list[dict]:
    findings: list[dict] = []
    files = _walk_code_files(repo_path)

    has_connection_pool = False
    has_memory_limit = False

    pool_pat = re.compile(r"""(?:pool_size|max_connections|connection_pool|NullPool|QueuePool|create_pool)""", re.I)
    memory_pat = re.compile(r"""(?:max_memory|memory_limit|resource\.setrlimit|ulimit|maxsize)""", re.I)
    unbounded_list_pat = re.compile(r"""(?:\.append\s*\(|\.extend\s*\()""")
    global_list_pat = re.compile(r"""^[A-Z_]+\s*[:=]\s*\[\]""")

    for rel, content in files:
        if pool_pat.search(content):
            has_connection_pool = True
        if memory_pat.search(content):
            has_memory_limit = True

        # NullPool explicitly disables connection pooling
        null_pool_pat = re.compile(r"""NullPool""")
        for lineno, snippet in _scan_lines(content, null_pool_pat, limit=1):
            findings.append(_finding(
                "resources",
                "Connection pooling explicitly disabled (NullPool)",
                "medium",
                "Using NullPool creates a new database connection for each request, "
                "increasing latency and exhausting connections under load.",
                rel, lineno, snippet,
                "Use QueuePool or the default pool with appropriate pool_size settings.",
            ))

        # Unbounded global collections
        for lineno, snippet in _scan_lines(content, global_list_pat, limit=2):
            findings.append(_finding(
                "resources",
                "Global mutable collection may grow unbounded",
                "low",
                f"A module-level list/dict in {rel} can accumulate entries over the "
                "lifetime of the process without cleanup.",
                rel, lineno, snippet,
                "Use an LRU cache with maxsize, or add periodic cleanup logic.",
            ))

    if not has_connection_pool:
        findings.append(_finding(
            "resources", "No connection pooling configuration found", "medium",
            "No connection pool settings (pool_size, max_connections) were detected. "
            "Default pools may be undersized for production traffic.",
            "(project root)", 0, "",
            "Configure connection pooling appropriate to deployment size.",
        ))

    # ThreadPoolExecutor without max_workers
    tpe_pat = re.compile(r"""ThreadPoolExecutor\s*\(\s*\)""")
    for rel, content in files:
        for lineno, snippet in _scan_lines(content, tpe_pat, limit=1):
            findings.append(_finding(
                "resources",
                "ThreadPoolExecutor created without max_workers limit",
                "low",
                "ThreadPoolExecutor() without max_workers defaults to 5x CPU count, "
                "which may over-provision threads.",
                rel, lineno, snippet,
                "Set an explicit max_workers based on expected concurrency.",
            ))

    return findings


# ── Red Team ─────────────────────────────────────────────────────────────────

def scan_redteam(repo_path: str) -> list[dict]:
    findings: list[dict] = []
    files = _walk_code_files(repo_path)

    # Prompt injection vectors: user content concatenated into prompts
    concat_prompt_pat = re.compile(
        r"""(?:f['"].*\{.*(?:user|input|query|prompt|message).*\}|"""
        r"""['"].*\+.*(?:user|input|query|prompt|message)|"""
        r"""\.format\s*\(.*(?:user|input|query|prompt|message))""",
        re.I,
    )
    system_prompt_pat = re.compile(r"""(?:system_prompt|SYSTEM_PROMPT|SystemMessage|system_message|role.*system)""", re.I)

    for rel, content in files:
        # User input directly concatenated into LLM messages
        if system_prompt_pat.search(content) and concat_prompt_pat.search(content):
            hits = _scan_lines(content, concat_prompt_pat, limit=2)
            for lineno, snippet in hits:
                findings.append(_finding(
                    "redteam",
                    "User input concatenated into LLM prompt without sanitization",
                    "high",
                    "User-controlled strings are interpolated directly into prompts, "
                    "enabling prompt injection attacks.",
                    rel, lineno, snippet,
                    "Separate system and user content using the message role API. "
                    "Add input validation and consider instruction-hierarchy defenses.",
                ))

    # System prompt exposed in error messages
    error_expose_pat = re.compile(r"""(?:raise.*(?:prompt|system|instruction)|except.*(?:str\(e\)|repr\(e\)))""", re.I)
    for rel, content in files:
        if system_prompt_pat.search(content):
            for lineno, snippet in _scan_lines(content, error_expose_pat, limit=1):
                findings.append(_finding(
                    "redteam",
                    "System prompt may leak through error messages",
                    "high",
                    "Error handling in a file containing system prompts may expose "
                    "internal instructions to the user via stack traces.",
                    rel, lineno, snippet,
                    "Sanitize exceptions before returning to clients; log details server-side only.",
                ))

    # No input filtering for jailbreak attempts
    jailbreak_filter_pat = re.compile(r"""(?:content.?filter|policy.?check|guard.?rail|safety.?check|moderation|input.?filter)""", re.I)
    has_jailbreak_filter = any(jailbreak_filter_pat.search(c) for _, c in files)
    llm_files = [(r, c) for r, c in files if system_prompt_pat.search(c)]
    if llm_files and not has_jailbreak_filter:
        findings.append(_finding(
            "redteam",
            "No input moderation or jailbreak filtering",
            "medium",
            "The codebase contains LLM prompts but no input moderation, content "
            "filtering, or jailbreak detection mechanism was found.",
            llm_files[0][0], 0, "",
            "Add a moderation/classification layer (OpenAI Moderation API, Guardrails, "
            "NeMo Guardrails) to filter adversarial inputs before they reach the model.",
        ))

    # Tool/function calling without allowlists
    tool_call_pat = re.compile(r"""(?:bind_tools|tool_choice|function_call|tools\s*=)""", re.I)
    allowlist_pat = re.compile(r"""(?:allow.*list|whitelist|permitted.*tool|valid.*tool)""", re.I)
    for rel, content in files:
        if tool_call_pat.search(content) and not allowlist_pat.search(content):
            hits = _scan_lines(content, tool_call_pat, limit=1)
            if hits:
                findings.append(_finding(
                    "redteam",
                    "Tool/function calling without explicit allowlisting",
                    "medium",
                    "LLM tool calling is enabled without visible allowlist validation. "
                    "A compromised model or prompt injection could invoke unintended tools.",
                    rel, hits[0][0], hits[0][1],
                    "Validate tool names against an explicit allowlist before execution.",
                ))
                break

    return findings


# ── Public dispatch ──────────────────────────────────────────────────────────

SCANNERS: dict[str, Any] = {
    "security": scan_security,
    "hallucinations": scan_hallucinations,
    "risk": scan_risk,
    "failures": scan_failures,
    "cost": scan_cost,
    "privacy": scan_privacy,
    "observability": scan_observability,
    "performance": scan_performance,
    "resources": scan_resources,
    "redteam": scan_redteam,
}


def run_static_analysis(repo_path: str, dimension: str) -> list[dict]:
    """Run the static scanner for *dimension* and return findings."""
    _reset_ids()
    scanner = SCANNERS.get(dimension)
    if not scanner:
        return []
    return scanner(repo_path)


def run_all_static_analysis(repo_path: str) -> dict[str, list[dict]]:
    """Run all static scanners and return {dimension: [findings]}."""
    _reset_ids()
    _file_cache.clear()
    results: dict[str, list[dict]] = {}
    for dim, scanner in SCANNERS.items():
        results[dim] = scanner(repo_path)
    _file_cache.clear()
    return results
