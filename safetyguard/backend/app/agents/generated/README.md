# Generated custom agents

Each subdirectory is named by **slug** and contains:

- `system_prompt.txt` — full LLM system prompt (`{static_summary}` is injected at runtime).
- `agent.py` — safe template calling `run_custom_dimension_agent` (not arbitrary generated code).

These files are optional references for humans and CI. The product still stores the spec on analysis runs and executes via `app.agents._agent_base.run_custom_dimension_agent`.

**Security:** Do not replace `agent.py` with untrusted code without review.
