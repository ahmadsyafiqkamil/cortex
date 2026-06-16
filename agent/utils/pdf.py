from __future__ import annotations

from pathlib import Path


class PdfError(Exception):
    """Raised when PDF text extraction fails."""


def extract_text(pdf_path: Path) -> str:
    """Extract all text from a PDF file using pdfplumber.

    Returns the concatenated text from all pages, joined by newlines.
    Raises PdfError if the file cannot be read or contains no extractable text.
    """
    try:
        import pdfplumber
    except ImportError:
        raise PdfError(
            "pdfplumber is not installed. Run: pip install pdfplumber>=0.11"
        )

    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        raise PdfError(f"PDF file not found: {pdf_path}")

    if pdf_path.suffix.lower() != ".pdf":
        raise PdfError(f"Not a PDF file: {pdf_path} (suffix: {pdf_path.suffix})")

    pages_text: list[str] = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for i, page in enumerate(pdf.pages, start=1):
                text = page.extract_text()
                if text:
                    pages_text.append(text)
    except Exception as exc:
        raise PdfError(f"Failed to read PDF {pdf_path.name}: {exc}") from exc

    if not pages_text:
        raise PdfError(f"No extractable text found in {pdf_path.name}")

    return "\n\n".join(pages_text)
