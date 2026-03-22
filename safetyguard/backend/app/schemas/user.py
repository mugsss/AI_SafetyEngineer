from pydantic import BaseModel


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    is_active: bool
    created_at: str

    model_config = {"from_attributes": True}
