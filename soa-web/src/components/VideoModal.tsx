'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink } from 'lucide-react';
import { useEffect } from 'react';

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: {
    title: string;
    embedUrl?: string;
    url: string;
    platform: string;
    thumbnail?: string;
  } | null;
}

export function VideoModal({ isOpen, onClose, video }: VideoModalProps) {
  // Close on Escape key and reload Twitter widgets
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      
      // Reload Twitter widgets if it's a Twitter embed
      if (video && (video.url.includes('twitter.com') || video.url.includes('x.com'))) {
        const script = document.createElement('script');
        script.src = 'https://platform.twitter.com/widgets.js';
        script.async = true;
        script.charset = 'utf-8';
        document.body.appendChild(script);
        
        // Wait a bit then render widgets
        setTimeout(() => {
          if ((window as any).twttr && (window as any).twttr.widgets) {
            (window as any).twttr.widgets.load();
          }
        }, 100);
      }
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, video]);

  if (!video) return null;

  const getEmbedUrl = () => {
    if (video.embedUrl) return video.embedUrl;
    
    // Generate embed URL from regular URL
    if (video.url.includes('youtube.com/watch') || video.url.includes('youtu.be/')) {
      const videoId = video.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
      if (videoId) return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
    }
    
    // Twitter/X embeds are handled differently - use the embed widget
    if (video.url.includes('twitter.com') || video.url.includes('x.com')) {
      return null; // Will use Twitter embed widget
    }
    
    return null;
  };

  const embedUrl = getEmbedUrl();
  const isTwitter = video.url.includes('twitter.com') || video.url.includes('x.com');

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          >
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                    {video.title}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1 capitalize">{video.platform}</p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View Original
                  </a>
                  <button
                    onClick={onClose}
                    className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Video Player */}
              <div className="relative bg-black aspect-video min-h-[500px] flex items-center justify-center">
                {embedUrl ? (
                  <iframe
                    src={embedUrl}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={video.title}
                  />
                ) : isTwitter ? (
                  <div className="w-full h-full flex items-center justify-center p-8">
                    <blockquote 
                      className="twitter-tweet" 
                      data-theme="dark"
                      data-conversation="none"
                      data-width="100%"
                    >
                      <a href={`${video.url}?ref_src=twsrc%5Etfw`}>
                        Loading tweet...
                      </a>
                    </blockquote>
                    {/* Fallback link */}
                    <a
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute bottom-4 right-4 inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open on X
                    </a>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center text-white">
                      <p className="text-lg mb-4">Video cannot be embedded</p>
                      <a
                        href={video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-900 rounded-xl font-semibold hover:bg-gray-100 transition"
                      >
                        <ExternalLink className="w-5 h-5" />
                        Watch on {video.platform}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

