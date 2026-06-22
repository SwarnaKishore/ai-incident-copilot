import re


CHUNK_SIZE = 1800
CHUNK_OVERLAP = 250


def chunk_text(text: str) -> list[str]:
    paragraphs = [paragraph.strip() for paragraph in re.split(r"\n\s*\n", text) if paragraph.strip()]
    chunks: list[str] = []
    current = ""

    for paragraph in paragraphs:
        next_chunk = f"{current}\n\n{paragraph}".strip() if current else paragraph

        if len(next_chunk) <= CHUNK_SIZE:
            current = next_chunk
            continue

        if current:
            chunks.append(current)

        if len(paragraph) <= CHUNK_SIZE:
            current = paragraph
        else:
            chunks.extend(split_long_text(paragraph))
            current = ""

    if current:
        chunks.append(current)

    return chunks


def split_long_text(text: str) -> list[str]:
    chunks: list[str] = []
    start = 0

    while start < len(text):
        end = min(start + CHUNK_SIZE, len(text))
        chunks.append(text[start:end])
        start = max(end - CHUNK_OVERLAP, end)

    return chunks
