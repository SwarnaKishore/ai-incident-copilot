from dataclasses import dataclass

from .document_store import StoredRunbookChunk
from .embedding_service import cosine_similarity, embed_text, matching_terms


@dataclass(frozen=True)
class VectorSearchResult:
    chunk: StoredRunbookChunk
    matched_terms: list[str]
    similarity: float


def search_chunks(query: str, chunks: list[StoredRunbookChunk], limit: int) -> list[VectorSearchResult]:
    query_embedding = embed_text(query)
    results = [
        VectorSearchResult(
            chunk=chunk,
            matched_terms=matching_terms(query_embedding, chunk.embedding),
            similarity=cosine_similarity(query_embedding, chunk.embedding),
        )
        for chunk in chunks
    ]

    return [
        result
        for result in sorted(results, key=lambda item: item.similarity, reverse=True)
        if result.similarity > 0
    ][:limit]
