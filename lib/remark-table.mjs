/**
 * GFM tables for MDX — and deliberately nothing else.
 *
 * next-mdx-remote parses core markdown only, and pipe tables are a GFM
 * extension, so a correctly written table rendered as one run-on paragraph:
 * "| | Kooli nägemiskontroll | ... |---|---|---| | **Kes teostab?** | ..."
 * (Silvia, 2026-09-16). Six posts are affected.
 *
 * The obvious fix is remark-gfm, but that bundles autolink literals, which
 * would silently turn the bare external URLs sitting in 26 post bodies
 * (pmc.ncbi.nlm.nih.gov, aao.org, jamanetwork.com, youtu.be …) into live
 * outbound links — against the no-external-links rule we enforced when
 * stripping 596 of them. Wiring just the table extension fixes the tables
 * without touching a single post body and without enabling anything else.
 *
 * Strikethrough, task lists and footnotes stay off: no post uses them.
 */
import { gfmTable } from "micromark-extension-gfm-table";
import { gfmTableFromMarkdown } from "mdast-util-gfm-table";

export default function remarkTable() {
  const data = this.data();
  const micromarkExtensions = data.micromarkExtensions || (data.micromarkExtensions = []);
  const fromMarkdownExtensions = data.fromMarkdownExtensions || (data.fromMarkdownExtensions = []);
  micromarkExtensions.push(gfmTable());
  fromMarkdownExtensions.push(gfmTableFromMarkdown());
}
