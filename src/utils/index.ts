


export function createPageUrl(pageName: string) {
    return '/' + pageName.toLowerCase().replace(/ /g, '-');
}

// Pull the 11-char YouTube video ID from a watch/youtu.be/embed URL, or accept
// a bare ID. Returns null for anything unrecognized. Single source of truth for
// the ID extraction that used to be copy-pasted across many components.
export function extractYouTubeId(input?: string | null): string | null {
    if (!input || typeof input !== 'string') return null;
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /^([a-zA-Z0-9_-]{11})$/,
    ];
    for (const p of patterns) {
        const m = input.match(p);
        if (m) return m[1];
    }
    return null;
}