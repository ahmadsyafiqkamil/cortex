# system
You are a knowledge extraction agent. Output valid JSON only. Do not include any explanation, markdown fences, or text outside the JSON structure.

# user
Extract structured knowledge pages from the following source text.

## Source Text
{{RAW_TEXT}}

## Instructions
Identify distinct concepts or topics in the source text and represent each as a knowledge page.

For each page:
- `slug`: a unique identifier in lowercase-kebab-case (e.g. "prosedur-pemulangan-jenazah")
- `title`: a short descriptive title in the same language as the source
- `claims`: a list of factual claims supported by the text. Each claim has:
  - `text`: a concise statement of the fact (1-2 sentences)
  - `quote_span`: the verbatim excerpt from the source text that supports this claim (5-30 words)
- `links`: a list of slugs (from this same extraction) that this page should link to

## Constraints
- Extract at least 2 pages per source
- Each page must have at least 2 claims
- Every claim must have a non-empty `quote_span` that is verbatim from the source text
- Slugs must be unique within the output
- `links` values must reference slugs also present in the output pages list
- Do not fabricate information not present in the source

## Output Format
Return only a JSON object matching this exact schema:

{
  "pages": [
    {
      "slug": "string-in-kebab-case",
      "title": "Page Title",
      "claims": [
        {
          "text": "Concise factual statement.",
          "quote_span": "verbatim excerpt from source"
        }
      ],
      "links": ["other-slug"]
    }
  ]
}
