import math
import re
from collections import Counter


TOKEN_PATTERN = re.compile(r"[a-z0-9]{3,}", re.IGNORECASE)
EMBEDDING_STOP_WORDS = {
    "the",
    "and",
    "are",
    "for",
    "with",
    "from",
    "that",
    "this",
    "when",
    "while",
    "after",
    "before",
    "service",
    "services",
    "incident",
    "issue",
    "error",
    "errors",
    "failed",
    "failure",
    "production",
}


SparseEmbedding = dict[str, float]


def embed_text(text: str) -> SparseEmbedding:
    tokens = [
        token
        for token in tokenize_for_embedding(text)
        if token not in EMBEDDING_STOP_WORDS
    ]
    counts = Counter(tokens)
    magnitude = math.sqrt(sum(count * count for count in counts.values()))

    if magnitude == 0:
        return {}

    return {token: count / magnitude for token, count in counts.items()}


def cosine_similarity(left: SparseEmbedding, right: SparseEmbedding) -> float:
    if not left or not right:
        return 0.0

    smaller, larger = (left, right) if len(left) <= len(right) else (right, left)
    return sum(value * larger.get(token, 0.0) for token, value in smaller.items())


def matching_terms(left: SparseEmbedding, right: SparseEmbedding, limit: int = 5) -> list[str]:
    matches = [
        (token, left[token] * right[token])
        for token in left.keys() & right.keys()
    ]

    return [
        token
        for token, _score in sorted(matches, key=lambda item: item[1], reverse=True)[:limit]
    ]


def tokenize_for_embedding(text: str) -> list[str]:
    normalized = re.sub(r"([a-z])([A-Z])", r"\1 \2", text)

    return [
        token
        for token in (match.group(0).lower() for match in TOKEN_PATTERN.finditer(normalized))
        if has_more_letters_than_digits(token)
    ]


def has_more_letters_than_digits(token: str) -> bool:
    letter_count = sum(character.isalpha() for character in token)
    digit_count = sum(character.isdigit() for character in token)

    return letter_count > 0 and letter_count >= digit_count
