# NCBO — UI Debugging & Feature Architecture Audit

**Target:** https://ncbo-git-audit-v1-branding-ncbo.vercel.app (branch `audit-v1-branding`)
**Date:** 2026-08-21
**Method:** live DOM inspection + computed-style measurement + RSC payload inspection,
signed in as the admin account.

> **Provenance note, added when this file was committed.** This is the Chrome UI audit,
> supplied as raw text and saved verbatim. It was **truncated by its author** to the
> constants and rules needed by Prompts A and C. Sections not reproduced below were not
> supplied and are not recoverable from this file.
>
> Companion document: `docs/NCBO-AUDIT-V1-ANSWERS.md`, which answers this audit's open
> questions against the source and a real database. **Where the two disagree, the answers
> file wins** — several inferences in the audit were checked and found wrong.

## 1.6 The fixes

### B. Club mark / avatar — delete the inline style

This is the structural fix. One component, one element, size as a variant, never a
number:

```ts
const SIZES = {
  xs: { box: "h-8 w-8 rounded-[6px]",                    text: "text-[11px]" },
  sm: { box: "h-10 w-10 rounded-[8px]",                  text: "text-[13px]" },
  md: { box: "h-10 w-10 rounded-[8px] md:h-12 md:w-12",  text: "text-[13px] md:text-[15px]" },
  lg: { box: "h-16 w-16 rounded-[10px]",                 text: "text-[20px]" },
} as const;
```

## 2.5 Onboarding UI

Replace the two independent selects with one school combobox over all 134 schools, then
show the resolved chapter inline and read-only.

## 3.2 Migration

Add `grad_year smallint`, `academic_level` enum, and `grad_year_inferred boolean`.
Backfill relative standings by projecting off the August academic year.

## 4.4 Step 2 — the server action

Authorise caller → typed-email confirmation → audit log write → storage purge →
`admin.auth.admin.deleteUser()`.
