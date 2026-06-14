from __future__ import annotations
from pathlib import Path


def extract_text(path: Path, max_chars: int = 4000) -> str:
    """Best-effort text extraction from an uploaded reference file (CV).
    Supports .txt, .pdf, .docx. Returns "" if extraction fails or the
    format is unsupported.
    """
    suffix = path.suffix.lower()
    try:
        if suffix == ".txt":
            return path.read_text(errors="ignore")[:max_chars]

        if suffix == ".pdf":
            from pypdf import PdfReader
            reader = PdfReader(str(path))
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
            return text[:max_chars]

        if suffix == ".docx":
            from docx import Document
            doc = Document(str(path))
            text = "\n".join(p.text for p in doc.paragraphs)
            return text[:max_chars]

    except Exception as e:
        print(f"Error extracting text from {path.name}: {e}")

    return ""
