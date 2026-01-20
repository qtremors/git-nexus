/**
 * SimpleMarkdown Component
 * 
 * Safe markdown renderer with XSS protection via DOMPurify.
 * Replaces raw `marked.parse()` + dangerouslySetInnerHTML usage.
 */

import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface SimpleMarkdownProps {
    content: string;
    className?: string;
}

/**
 * Renders markdown content safely with XSS protection.
 * Uses marked for parsing and DOMPurify for sanitization.
 */
export function SimpleMarkdown({ content, className = '' }: SimpleMarkdownProps) {
    const sanitizedHtml = useMemo(() => {
        // Parse markdown to HTML
        const rawHtml = marked.parse(content) as string;

        // Sanitize to prevent XSS attacks
        const cleanHtml = DOMPurify.sanitize(rawHtml, {
            ALLOWED_TAGS: [
                'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                'p', 'br', 'hr',
                'ul', 'ol', 'li',
                'strong', 'b', 'em', 'i', 'u', 's', 'del',
                'a', 'img',
                'code', 'pre', 'blockquote',
                'table', 'thead', 'tbody', 'tr', 'th', 'td',
                'div', 'span',
            ],
            ALLOWED_ATTR: [
                'href', 'src', 'alt', 'title', 'class', 'id',
                'target', 'rel',
            ],
            // Force links to open in new tab safely
            ADD_ATTR: ['target', 'rel'],
            FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input'],
            FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
        });

        return cleanHtml;
    }, [content]);

    return (
        <div
            className={`text-slate-300 leading-relaxed break-words
                [&>h1]:text-3xl [&>h1]:font-bold [&>h1]:text-white [&>h1]:mt-8 [&>h1]:mb-4 [&>h1]:pb-2 [&>h1]:border-b [&>h1]:border-slate-800
                [&>h2]:text-2xl [&>h2]:font-bold [&>h2]:text-white [&>h2]:mt-8 [&>h2]:mb-4 [&>h2]:pb-2 [&>h2]:border-b [&>h2]:border-slate-800
                [&>h3]:text-xl [&>h3]:font-bold [&>h3]:text-white [&>h3]:mt-6 [&>h3]:mb-4
                [&>h4]:text-lg [&>h4]:font-bold [&>h4]:text-white [&>h4]:mt-4 [&>h4]:mb-2
                [&>p]:mb-4 [&>p]:leading-7
                [&>ul]:list-disc [&>ul]:ml-6 [&>ul]:mb-4
                [&>ol]:list-decimal [&>ol]:ml-6 [&>ol]:mb-4
                [&>li]:mb-1
                [&_a]:text-blue-400 [&_a]:no-underline hover:[&_a]:underline
                [&_img]:inline-block [&_img]:max-w-full [&_img]:my-0
                [&_blockquote]:border-l-4 [&_blockquote]:border-slate-700 [&_blockquote]:pl-4 [&_blockquote]:text-slate-400 [&_blockquote]:italic [&_blockquote]:mb-4
                [&_pre]:bg-[#161b22] [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:mb-4 [&_pre]:border [&_pre]:border-slate-800
                [&_code]:font-mono [&_code]:text-sm
                [&_:not(pre)>code]:bg-[rgba(110,118,129,0.4)] [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:rounded-md [&_:not(pre)>code]:text-white
                [&_table]:w-full [&_table]:border-collapse [&_table]:mb-4
                [&_th]:text-left [&_th]:p-2 [&_th]:border [&_th]:border-slate-800 [&_th]:bg-slate-900/50
                [&_td]:p-2 [&_td]:border [&_td]:border-slate-800
                ${className}`}
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
    );
}

/**
 * Simple visual markdown renderer (no external library)
 * Used for profile READMEs where less markup is needed.
 */
export function SimpleMarkdownVisual({ content }: { content: string }) {
    const lines = content.split('\n');

    return (
        <div className="space-y-2 text-slate-300 font-sans">
            {lines.map((line, idx) => {
                if (line.startsWith('# ')) {
                    return (
                        <h1 key={idx} className="text-2xl font-bold text-white mt-4 border-b border-slate-700 pb-2">
                            {line.replace('# ', '')}
                        </h1>
                    );
                }
                if (line.startsWith('## ')) {
                    return (
                        <h2 key={idx} className="text-xl font-semibold text-white mt-3">
                            {line.replace('## ', '')}
                        </h2>
                    );
                }
                if (line.startsWith('### ')) {
                    return (
                        <h3 key={idx} className="text-lg font-medium text-white mt-2">
                            {line.replace('### ', '')}
                        </h3>
                    );
                }
                if (line.startsWith('- ')) {
                    return (
                        <div key={idx} className="flex items-start ml-4">
                            <span className="mr-2 text-blue-400">•</span>
                            {line.replace('- ', '')}
                        </div>
                    );
                }
                if (line.startsWith('```')) {
                    return (
                        <div key={idx} className="bg-slate-950 p-3 rounded border border-slate-800 font-mono text-sm text-yellow-400 my-2">
                            Code Block
                        </div>
                    );
                }
                if (line.trim() === '') {
                    return <div key={idx} className="h-2" />;
                }
                return (
                    <p key={idx} className="leading-relaxed text-sm">
                        {line}
                    </p>
                );
            })}
        </div>
    );
}
