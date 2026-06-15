# system
You are a wiki page author. Write clear, well-structured wiki pages in the canonical Cortex format. Output only the markdown content — no explanations, no preamble.

# user
Write a wiki page based on the following extracted knowledge.

## Page Metadata
- Slug: {{SLUG}}
- Title: {{TITLE}}
- Source blob ID placeholder: {{SRC}}
- Creation date: {{DATE}}
- Related pages (wikilinks): {{LINKS}}

## Extracted Claims
{{CLAIMS_JSON}}

## Instructions
Write a complete wiki page in the canonical Cortex format:

1. Start with a YAML frontmatter block (between `---` delimiters) containing:
   - `title`: the page title
   - `slug`: the page slug
   - `tags`: a list of relevant topic tags (2-5 tags)
   - `sources`: a list with one entry: `{blob: "{{SRC}}", title: "source document"}`
   - `created`: the creation date ({{DATE}})

2. After the frontmatter, write the page body:
   - Use `# {{TITLE}}` as the H1 heading
   - Organize content into logical sections with `##` subheadings
   - Every factual statement must end with a provenance marker: `^[blob:{{SRC}}]`
   - Link to related pages using wikilink syntax: `[[slug]]`
   - Write in a clear, encyclopedic style

## Canonical Format Example
---
title: Example Page
slug: example-page
tags: [tag1, tag2]
sources:
  - blob: "{{SRC}}"
    title: "Source document title"
created: {{DATE}}
---
# Example Page

## Overview

This is an overview of the topic.^[blob:{{SRC}}]

## Details

Key details about this topic are explained here.^[blob:{{SRC}}] See also [[related-page]].

## Requirements
- Include ALL claims from the extracted claims list
- Use `{{SRC}}` literally as the blob ID placeholder — do NOT invent or substitute blob IDs
- Every claim must appear with a `^[blob:{{SRC}}]` provenance marker
- Wikilinks must use lowercase-kebab slugs matching the related pages list
- The YAML frontmatter must be valid YAML
