import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.custom_agent import (
    CustomAgentConfigInput,
    ExportAgentPackageInput,
    ExportAgentPackageResponse,
    GenerateCustomAgentResponse,
    GeneratedCustomAgentSpec,
)
from app.services.agent_module_export import write_generated_agent_package
from app.services.custom_agent_service import generate_custom_agent_spec

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/generate", response_model=GenerateCustomAgentResponse)
def generate_custom_agent(
    body: CustomAgentConfigInput,
    _user: User = Depends(get_current_user),
):
    """Use the workspace LLM to produce a system prompt and illustrative Python stub."""
    try:
        spec = generate_custom_agent_spec(body)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except Exception as e:
        logger.exception("custom agent generation failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM generation failed: {e!s}",
        ) from e

    exported: list[str] | None = None
    if body.export_generated_module:
        try:
            exported = write_generated_agent_package(spec)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
        except OSError as e:
            logger.exception("custom agent export failed")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to write generated files: {e!s}",
            ) from e

    return GenerateCustomAgentResponse(spec=spec, exported_paths=exported)


@router.post("/export-module", response_model=ExportAgentPackageResponse)
def export_agent_package(
    body: ExportAgentPackageInput,
    _user: User = Depends(get_current_user),
):
    """Write ``app/agents/generated/{slug}/`` from a spec without calling the LLM."""
    stub = GeneratedCustomAgentSpec(
        slug=body.slug,
        display_name=body.display_name,
        base_dimension=body.base_dimension,
        system_prompt=body.system_prompt,
        agent_python_stub="# Placeholder; export uses template in agent.py.",
    )
    try:
        paths = write_generated_agent_package(stub)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except OSError as e:
        logger.exception("custom agent export failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to write generated files: {e!s}",
        ) from e
    return ExportAgentPackageResponse(exported_paths=paths)
