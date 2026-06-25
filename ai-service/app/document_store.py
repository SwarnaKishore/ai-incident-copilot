from dataclasses import dataclass
from uuid import uuid4

from .embedding_service import SparseEmbedding, embed_text
from .text_chunker import chunk_text


@dataclass(frozen=True)
class StoredRunbookChunk:
    document_id: str
    file_name: str
    chunk_index: int
    content: str
    embedding: SparseEmbedding


_documents: dict[str, list[StoredRunbookChunk]] = {}


def store_runbook_document(file_name: str, content: str) -> tuple[str, int]:
    document_id = uuid4().hex
    chunks = [
        StoredRunbookChunk(
            document_id=document_id,
            file_name=file_name,
            chunk_index=index,
            content=chunk,
            embedding=embed_text(chunk),
        )
        for index, chunk in enumerate(chunk_text(content), start=1)
    ]

    _documents[document_id] = chunks
    return document_id, len(chunks)


def get_runbook_chunks(document_ids: list[str]) -> list[StoredRunbookChunk]:
    chunks: list[StoredRunbookChunk] = []

    for document_id in document_ids:
        chunks.extend(_documents.get(document_id, []))

    return chunks
