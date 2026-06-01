/**
 * @file   VideoPicker.jsx
 * @desc   Step 1 of the /Try funnel. Lets a visitor paste a YouTube URL or
 *         search YouTube directly (proxied through publicTryFunnel). Calls
 *         onPicked({ videoId }) once a video is selected.
 */
import React, { useState } from 'react';
import { supabase } from '@/components/lib/supabase-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Youtube, Link as LinkIcon } from 'lucide-react';

function extractVideoId(url) {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^[A-Za-z0-9_-]{6,15}$/.test(trimmed)) return trimmed;
  const patterns = [
    /youtube\.com\/watch\?v=([A-Za-z0-9_-]{6,15})/,
    /youtu\.be\/([A-Za-z0-9_-]{6,15})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{6,15})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{6,15})/,
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m) return m[1];
  }
  return null;
}

function formatDuration(seconds) {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function VideoPicker({ onPicked }) {
  const [url, setUrl] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleUrlSubmit = (e) => {
    e?.preventDefault();
    setError('');
    const videoId = extractVideoId(url);
    if (!videoId) {
      setError('That does not look like a valid YouTube URL.');
      return;
    }
    setSubmitting(true);
    onPicked({ videoId });
  };

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError('');
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('publicTryFunnel', {
        body: { action: 'search', query: query.trim() },
      });
      if (fnErr) throw fnErr;
      setResults(data?.items ?? []);
      if ((data?.items ?? []).length === 0) {
        setError('No long-form videos found for that search. Try different keywords.');
      }
    } catch (err) {
      setError(err?.message || 'Could not search YouTube. Try again.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* URL input */}
      <form onSubmit={handleUrlSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
          <LinkIcon className="w-4 h-4" /> Paste a YouTube URL
        </label>
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="flex-1"
            disabled={submitting}
          />
          <Button type="submit" disabled={submitting || !url.trim()}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generate'}
          </Button>
        </div>
      </form>

      <div className="flex items-center gap-4 my-6">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs uppercase tracking-wider text-slate-500">or search YouTube</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
          <Youtube className="w-4 h-4" /> Search YouTube
        </label>
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='e.g. "photosynthesis explained"'
            className="flex-1"
            disabled={searching}
          />
          <Button type="submit" variant="secondary" disabled={searching || !query.trim()}>
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>

        {results.length > 0 && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {results.map((r) => (
              <button
                key={r.videoId}
                type="button"
                onClick={() => { setSubmitting(true); onPicked({ videoId: r.videoId, preview: r }); }}
                className="text-left group rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition overflow-hidden bg-white"
              >
                <div className="relative aspect-video bg-slate-100">
                  {r.thumbnail && (
                    <img
                      src={r.thumbnail}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  )}
                  <span className="absolute bottom-2 right-2 text-[10px] bg-black/75 text-white px-1.5 py-0.5 rounded">
                    {formatDuration(r.duration)}
                  </span>
                </div>
                <div className="p-3">
                  <h4 className="text-sm font-semibold text-slate-900 line-clamp-2">{r.title}</h4>
                  <p className="text-xs text-slate-500 mt-1">{r.channelTitle}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </form>

      {error && (
        <p className="mt-4 text-sm text-red-600 text-center" role="alert">{error}</p>
      )}
    </div>
  );
}
