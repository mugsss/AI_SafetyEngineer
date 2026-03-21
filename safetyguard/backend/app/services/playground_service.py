import random

from app.config import settings


async def run_playground_query(
    prompt: str,
    app_base_url: str | None = None,
    model_profile: str | None = None,
) -> dict:
    if settings.is_mock_mode:
        score = random.randint(10, 85)
        flags = []
        if score > 60:
            flags.append("high_hallucination_risk")
        if "ignore" in prompt.lower() or "pretend" in prompt.lower():
            flags.append("potential_jailbreak")
        if score > 40:
            flags.append("low_groundedness")

        return {
            "response_text": f"[Mock Response] Analysis of prompt: '{prompt[:80]}...' "
            f"This is a simulated response for development purposes.",
            "hallucination_score": score,
            "safety_flags": flags,
            "explanation": f"Mock analysis: The prompt has a hallucination risk score of {score}/100. "
            f"{'High risk detected due to ungrounded claims.' if score > 60 else 'Moderate risk level.'}",
        }

    try:
        from langchain_openai import ChatOpenAI

        llm = ChatOpenAI(model=settings.OPENAI_MODEL, temperature=0)
        analysis_prompt = (
            f"Analyze this prompt for hallucination risk and safety:\n\n"
            f"Prompt: {prompt}\n\n"
            f"Respond with JSON: {{\"response_text\": \"...\", \"hallucination_score\": 0-100, "
            f"\"safety_flags\": [...], \"explanation\": \"...\"}}"
        )
        result = await llm.ainvoke(analysis_prompt)
        import json
        return json.loads(result.content)
    except Exception as e:
        return {
            "response_text": f"Error analyzing prompt: {str(e)}",
            "hallucination_score": 50,
            "safety_flags": ["analysis_error"],
            "explanation": f"Analysis failed: {str(e)}",
        }
