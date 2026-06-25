from io import BytesIO
from pathlib import Path

from fastapi import HTTPException, UploadFile
from pypdf import PdfReader


MAX_RUNBOOK_UPLOAD_BYTES = 2 * 1024 * 1024
SUPPORTED_EXTENSIONS = {".md", ".txt", ".pdf"}


async def extract_runbook_text(file: UploadFile) -> tuple[str, str]:
    file_name = Path(file.filename or "").name
    extension = Path(file_name).suffix.lower()

    if extension not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Upload a Markdown, text, or PDF runbook file.",
        )

    content = await file.read()

    if not content:
        raise HTTPException(status_code=400, detail="Uploaded runbook file is empty.")

    if len(content) > MAX_RUNBOOK_UPLOAD_BYTES:
        raise HTTPException(
            status_code=400,
            detail="Runbook file is too large. Upload a .md, .txt, or .pdf file under 2 MB.",
        )

    if extension == ".pdf":
        text = extract_pdf_text(content)
    else:
        text = decode_text_file(content)

    normalized_text = "\n".join(line.rstrip() for line in text.splitlines()).strip()

    if not normalized_text:
        raise HTTPException(
            status_code=400,
            detail="Could not extract readable text from this runbook file.",
        )

    return file_name, normalized_text


def decode_text_file(content: bytes) -> str:
    try:
        return content.decode("utf-8")
    except UnicodeDecodeError:
        return content.decode("utf-8", errors="ignore")


def extract_pdf_text(content: bytes) -> str:
    try:
        reader = PdfReader(BytesIO(content))
        return "\n\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail="Could not read this PDF. Try exporting it as text or uploading a different PDF.",
        ) from error
