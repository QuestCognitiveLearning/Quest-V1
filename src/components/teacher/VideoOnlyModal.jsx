import React, { useState, useEffect } from "react";
import { quest } from "@/api/questClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { X, Loader2, Play, CheckCircle, Link as LinkIcon } from "lucide-react";
import { invokeLLM } from "@/components/utils/openai";
import { LLM_MODELS } from "@/lib/llmModels";

export default function VideoOnlyModal({ subunit, curriculumName, onClose, onVideoAdded }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null); // Track which video is being saved
  const [customUrl, setCustomUrl] = useState("");
  const [loadingCustom, setLoadingCustom] = useState(false);

  useEffect(() => {
    searchVideos();
  }, []);

  const searchVideos = async () => {
    try {
      const searchQuery = `${curriculumName || ''} ${subunit.subunit_name} educational tutorial`.trim();
      
      const { data } = await quest.functions.invoke('youtubeSearch', { action: "search", query: searchQuery });
      
      if (data.items) {
        const videoIds = data.items.map(item => item.id.videoId).join(',');
        const { data: durationData } = await quest.functions.invoke('youtubeSearch', { action: "durations", videoIds });
        const durationMap = {};
        if (durationData.items) {
          durationData.items.forEach(item => {
            durationMap[item.id] = parseYouTubeDuration(item.contentDetails.duration);
          });
        }

        // Long-form gate (client-side defense in depth). The youtubeSearch
        // edge function strips ≤60s videos server-side, but if a future call
        // site bypasses it or the durations lookup races, this ensures
        // Shorts / clips never reach the picker.
        const eligibleItems = data.items.filter((item) => {
          const duration = durationMap[item.id.videoId] || 0;
          return duration > 60;
        });

        // Generate all summaries in parallel
        const summaries = await Promise.all(
          eligibleItems.map(item =>
            generateVideoSummary(item.snippet.title, item.snippet.description)
          )
        );

        const videoSummaries = eligibleItems.map((item, index) => ({
          videoId: item.id.videoId,
          title: item.snippet.title,
          thumbnail: item.snippet.thumbnails.high.url,
          summary: summaries[index],
          url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
          durationSeconds: durationMap[item.id.videoId] || 0
        }));
        
        setVideos(videoSummaries);
      }
    } catch (error) {
      console.error("Failed to search videos:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateVideoSummary = async (title, description) => {
    try {
      const response = await invokeLLM({
        model: LLM_MODELS.VIDEO_SUMMARY,
        prompt: `Summarize this educational video in 2-3 sentences focusing on key learning points:

Title: ${title}
Description: ${description}`,
      });
      return response;
    } catch (error) {
      return "Summary unavailable";
    }
  };

  const parseYouTubeDuration = (duration) => {
    if (!duration) return 0;
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return 0;
    const hours = (parseInt(match[1]) || 0);
    const minutes = (parseInt(match[2]) || 0);
    const seconds = (parseInt(match[3]) || 0);
    return hours * 3600 + minutes * 60 + seconds;
  };

  const extractYouTubeVideoId = (url) => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const handleSelectVideo = async (video) => {
    setSaving(video.videoId);
    try {
      await quest.entities.Video.create({
        subunit_id: subunit.id,
        video_url: video.url,
        video_transcript: video.summary,
        duration_seconds: video.durationSeconds
      });

      onVideoAdded();
    } catch (error) {
      console.error("Failed to save video:", error);
      alert("Failed to save video: " + error.message);
    } finally {
      setSaving(null);
    }
  };

  const handleAddCustomVideo = async () => {
    if (!customUrl.trim()) return;
    
    setLoadingCustom(true);
    try {
      const videoId = extractYouTubeVideoId(customUrl);
      if (!videoId) {
        alert("Invalid YouTube URL. Please check and try again.");
        setLoadingCustom(false);
        return;
      }

      const { data } = await quest.functions.invoke('youtubeSearch', { action: "videoDetails", videoId });
      
      if (!data.items || data.items.length === 0) {
        alert("Video not found. Please check the URL.");
        setLoadingCustom(false);
        return;
      }

      const item = data.items[0];
      const summary = await generateVideoSummary(item.snippet.title, item.snippet.description);
      const durationData = data;
      let durationSeconds = 0;
      if (durationData.items && durationData.items[0]) {
        durationSeconds = parseYouTubeDuration(durationData.items[0].contentDetails.duration);
      }

      const video = {
        videoId: videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.high.url,
        summary: summary,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        durationSeconds: durationSeconds
      };

      setCustomUrl("");
      setLoadingCustom(false);
      handleSelectVideo(video);
    } catch (error) {
      console.error("Failed to add custom video:", error);
      alert("Failed to load video. Please try again.");
      setLoadingCustom(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-5xl max-h-[90vh] overflow-y-auto border-0 shadow-2xl">
        <CardContent className="p-0">
          <div className="sticky top-0 bg-blue-600 text-white p-6 z-10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Add Video</h2>
                <p className="text-blue-100 text-sm">{subunit.subunit_name}</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="mb-6 p-6 bg-blue-50 border-2 border-blue-200 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <LinkIcon className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">Add Custom YouTube Video</h3>
              </div>
              <p className="text-sm text-gray-600 mb-3">Paste a YouTube URL</p>
              <div className="flex gap-3">
                <Input
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="flex-1"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddCustomVideo()}
                />
                <Button
                  onClick={handleAddCustomVideo}
                  disabled={!customUrl.trim() || loadingCustom || saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {loadingCustom ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Add Video
                    </>
                  )}
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mb-4" />
                <p className="text-gray-600 text-lg">Searching YouTube...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Play className="w-4 h-4" />
                  Quest Recommendations
                </h3>
                {videos.map((video) => (
                  <Card key={video.videoId} className="border-2 border-blue-200 hover:border-blue-400 hover:shadow-lg transition-all">
                    <CardContent className="p-5">
                      <div className="flex gap-5">
                        <img
                          src={video.thumbnail}
                          alt={video.title}
                          onClick={() => window.open(video.url, '_blank')}
                          className="w-48 h-36 object-cover rounded-xl shadow-md flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                        />
                        
                        <div className="flex-1 flex flex-col">
                          <h3 className="font-semibold text-gray-900 text-lg line-clamp-2 mb-2">{video.title}</h3>
                          <span className="text-sm font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded mb-2 w-fit">
                            {Math.floor(video.durationSeconds / 60)}:{String(video.durationSeconds % 60).padStart(2, '0')}
                          </span>
                          <p className="text-sm text-gray-600 line-clamp-2 flex-1">{video.summary}</p>
                          
                          <Button
                            onClick={() => handleSelectVideo(video)}
                            disabled={saving === video.videoId}
                            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg self-start mt-2"
                          >
                            {saving === video.videoId ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Adding...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Select
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}