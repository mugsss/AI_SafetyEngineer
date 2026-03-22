from pydantic import BaseModel, Field


class WorkflowWebhookCreate(BaseModel):
    name: str = Field(default="n8n", max_length=120)
    url: str = Field(..., max_length=2048)
    secret: str | None = Field(default=None, max_length=512)
    enabled: bool = True


class WorkflowWebhookUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    url: str | None = Field(default=None, max_length=2048)
    secret: str | None = Field(default=None, max_length=512)
    enabled: bool | None = None


class WorkflowWebhookOut(BaseModel):
    id: str
    name: str
    url: str
    has_secret: bool
    enabled: bool
    created_at: str

    model_config = {"from_attributes": False}


class WorkflowWebhookTestIn(BaseModel):
    url: str = Field(..., max_length=2048)
    secret: str | None = Field(default=None, max_length=512)
