from typing import Optional

from pydantic import BaseModel, Field


class IncidentAnalysisRequest(BaseModel):
    serviceName: str = Field(min_length=1, max_length=80)
    environment: str = Field(min_length=1)
    severity: str = Field(min_length=1)
    symptoms: str = Field(min_length=1, max_length=1000)
    logs: str = Field(min_length=1, max_length=4000)
    companyRunbookNotes: str = Field(default="", max_length=3000)
    uploadedRunbookText: str = Field(default="", max_length=25000)
    runbookDocumentIds: list[str] = Field(default_factory=list)
    analysisMode: str = "mock"


class RetrievedRunbookReference(BaseModel):
    title: str
    path: str
    reason: str


class StakeholderUpdates(BaseModel):
    engineering: str
    customer: str
    executive: str


class IncidentAnalysisResponse(BaseModel):
    summary: str
    probableCause: str
    confidence: str
    evidence: list[str]
    recommendedSteps: list[str]
    draftUpdate: str
    analysisProvider: str = "Claude"
    model: str = "claude-haiku-4-5"
    retrievedRunbooks: list[RetrievedRunbookReference] = Field(default_factory=list)
    stakeholderUpdates: Optional[StakeholderUpdates] = None


class RetrievedRunbook(BaseModel):
    title: str
    path: str
    reason: str
    content: str
    score: int


class RunbookUploadRequest(BaseModel):
    fileName: str = Field(min_length=1, max_length=160)
    content: str = Field(min_length=1, max_length=25000)


class RunbookUploadResponse(BaseModel):
    documentId: str
    fileName: str
    chunkCount: int
