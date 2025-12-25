'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Header, Footer } from '@/components';
import { FadeIn, SlideIn, ScaleIn, StaggerChildren } from '@/components/animations';
import {
  Play,
  Image as ImageIcon,
  Video,
  ExternalLink,
  Filter,
  ChevronRight,
  Heart,
  Share2,
  MessageCircle,
  Eye,
  Calendar,
  Youtube,
  Instagram,
  Facebook,
  Twitter,
  Music2,
} from 'lucide-react';

// Platform types
type Platform = 'all' | 'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'twitter';
type MediaType = 'all' | 'video' | 'image' | 'post';

interface MediaItem {
  id: string;
  platform: Platform;
  type: MediaType;
  title: string;
  description: string;
  thumbnail: string;
  url: string;
  embedUrl?: string;
  date: string;
  stats: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
  };
}

// Sample media content - In production, this would come from social media APIs
const mediaItems: MediaItem[] = [
  {
    id: '1',
    platform: 'twitter',
    type: 'video',
    title: 'SOA March in Mamelodi',
    description: '[WATCH] The Soil of Africa led a march in Mamelodi, east of Pretoria, to demand employment for SA citizens. The civic movement claims the N4 Gateway industrial park prioritises undocumented foreigners over locals.',
    thumbnail: '/media/march-thumb.jpg',
    url: 'https://twitter.com/SABCNews/status/1949862717621178383',
    date: '2025-07-28',
    stats: { views: 45000, likes: 2300, shares: 890 },
  },
  {
    id: '2',
    platform: 'youtube',
    type: 'video',
    title: 'Skills Development Programme Launch',
    description: 'Official launch of the skills development programme at Mamelodi Skills Centre. Training in entrepreneurship, agriculture, ICT, and more.',
    thumbnail: '/media/skills-launch.jpg',
    url: 'https://www.youtube.com/@soilofafrica',
    embedUrl: 'https://www.youtube.com/embed/VIDEO_ID',
    date: '2025-06-15',
    stats: { views: 12500, likes: 890, comments: 156 },
  },
  {
    id: '3',
    platform: 'facebook',
    type: 'image',
    title: 'Youth Chapter Community Outreach',
    description: 'Our youth chapter leading community service initiatives in Gauteng. Building the next generation of African leaders.',
    thumbnail: '/media/youth-outreach.jpg',
    url: 'https://www.facebook.com/61575839187032',
    date: '2025-07-20',
    stats: { likes: 1200, comments: 89, shares: 234 },
  },
  {
    id: '4',
    platform: 'instagram',
    type: 'image',
    title: 'President Address at Skills Centre',
    description: '#SIZOSEBENZANGENKANI - Our President addressing members at the newly opened Skills Development Centre.',
    thumbnail: '/media/president-address.jpg',
    url: 'https://www.instagram.com/soilofafrica',
    date: '2025-07-15',
    stats: { likes: 3400, comments: 178 },
  },
  {
    id: '5',
    platform: 'tiktok',
    type: 'video',
    title: 'Day in the Life - Skills Training',
    description: 'Follow our students through a day of agricultural training. From classroom to farm! 🌱',
    thumbnail: '/media/training-day.jpg',
    url: 'https://www.tiktok.com/@soilofafrica',
    date: '2025-07-22',
    stats: { views: 89000, likes: 5600, shares: 1200 },
  },
  {
    id: '6',
    platform: 'twitter',
    type: 'post',
    title: 'Job Creation Milestone',
    description: '🎉 500+ jobs secured through our partnership with local businesses! Our mission to reduce unemployment from 62.7% to 40% continues. #SIZOSEBENZANGENKANI',
    thumbnail: '',
    url: 'https://x.com/soilofafricasa',
    date: '2025-07-25',
    stats: { likes: 890, shares: 345 },
  },
];

// Social platforms config
const platforms = [
  { id: 'all', name: 'All Platforms', icon: Filter },
  { id: 'youtube', name: 'YouTube', icon: Youtube, color: 'bg-red-500', url: 'https://www.youtube.com/@soilofafrica' },
  { id: 'tiktok', name: 'TikTok', icon: Music2, color: 'bg-gray-900', url: 'https://www.tiktok.com/@soilofafrica' },
  { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400', url: 'https://www.instagram.com/soilofafrica' },
  { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'bg-blue-600', url: 'https://www.facebook.com/61575839187032' },
  { id: 'twitter', name: 'X/Twitter', icon: Twitter, color: 'bg-gray-900', url: 'https://x.com/soilofafricasa' },
];

export default function MediaPage() {
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('all');
  const [selectedType, setSelectedType] = useState<MediaType>('all');

  const filteredMedia = mediaItems.filter((item) => {
    const platformMatch = selectedPlatform === 'all' || item.platform === selectedPlatform;
    const typeMatch = selectedType === 'all' || item.type === selectedType;
    return platformMatch && typeMatch;
  });

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getPlatformIcon = (platform: Platform) => {
    const found = platforms.find(p => p.id === platform);
    return found?.icon || Filter;
  };

  const getPlatformColor = (platform: Platform) => {
    const found = platforms.find(p => p.id === platform);
    return found?.color || 'bg-gray-500';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Hero Section */}
      <section className="pt-24 pb-12 bg-gradient-to-br from-soa-primary via-soa-dark to-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <FadeIn>
              <h1 className="text-4xl sm:text-5xl font-bold mb-4">
                SOA Media Hub
              </h1>
            </FadeIn>
            <SlideIn direction="up" delay={0.2}>
              <p className="text-lg text-gray-300 max-w-2xl mx-auto">
                Videos, photos, and updates from the Soil of Africa movement. 
                Follow us on social media to stay connected with our mission.
              </p>
            </SlideIn>
          </div>

          {/* Social Platform Links */}
          <StaggerChildren className="flex flex-wrap justify-center gap-4 mt-8" staggerDelay={0.1}>
            {platforms.slice(1).map((platform) => (
              <motion.a
                key={platform.id}
                href={platform.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-2 px-5 py-3 ${platform.color} text-white rounded-xl font-medium hover:opacity-90 transition shadow-lg`}
                whileHover={{ scale: 1.05, y: -3 }}
                whileTap={{ scale: 0.95 }}
              >
                <platform.icon className="w-5 h-5" />
                {platform.name}
                <ExternalLink className="w-4 h-4 opacity-60" />
              </motion.a>
            ))}
          </StaggerChildren>
        </div>
      </section>

      {/* Filter Bar */}
      <section className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            {/* Platform Filter */}
            <div className="flex flex-wrap gap-2">
              {platforms.map((platform) => (
                <button
                  key={platform.id}
                  onClick={() => setSelectedPlatform(platform.id as Platform)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition ${
                    selectedPlatform === platform.id
                      ? 'bg-soa-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <platform.icon className="w-4 h-4" />
                  {platform.name}
                </button>
              ))}
            </div>

            {/* Type Filter */}
            <div className="flex gap-2">
              {[
                { id: 'all', name: 'All', icon: Filter },
                { id: 'video', name: 'Videos', icon: Video },
                { id: 'image', name: 'Photos', icon: ImageIcon },
                { id: 'post', name: 'Posts', icon: MessageCircle },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id as MediaType)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition ${
                    selectedType === type.id
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <type.icon className="w-4 h-4" />
                  {type.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Media Grid */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {filteredMedia.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Video className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No content found</h3>
              <p className="text-gray-500">Try adjusting your filters or check back later.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMedia.map((item, index) => {
                const PlatformIcon = getPlatformIcon(item.platform);
                
                return (
                  <motion.a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition group"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    whileHover={{ y: -5 }}
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-video bg-gray-100">
                      {item.thumbnail ? (
                        <div className="w-full h-full bg-gradient-to-br from-soa-primary/20 to-soa-secondary/20 flex items-center justify-center">
                          {item.type === 'video' && (
                            <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center group-hover:scale-110 transition">
                              <Play className="w-8 h-8 text-soa-primary ml-1" />
                            </div>
                          )}
                          {item.type === 'image' && (
                            <ImageIcon className="w-12 h-12 text-soa-primary/50" />
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                          <MessageCircle className="w-12 h-12 text-gray-400" />
                        </div>
                      )}

                      {/* Platform Badge */}
                      <div className={`absolute top-3 left-3 ${getPlatformColor(item.platform)} text-white px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5`}>
                        <PlatformIcon className="w-3.5 h-3.5" />
                        {platforms.find(p => p.id === item.platform)?.name}
                      </div>

                      {/* Type Badge */}
                      <div className="absolute top-3 right-3 bg-black/60 text-white px-2 py-1 rounded text-xs capitalize">
                        {item.type}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-soa-primary transition">
                        {item.title}
                      </h3>
                      <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                        {item.description}
                      </p>

                      {/* Stats */}
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <div className="flex items-center gap-4">
                          {item.stats.views && (
                            <span className="flex items-center gap-1">
                              <Eye className="w-4 h-4" />
                              {formatNumber(item.stats.views)}
                            </span>
                          )}
                          {item.stats.likes && (
                            <span className="flex items-center gap-1">
                              <Heart className="w-4 h-4" />
                              {formatNumber(item.stats.likes)}
                            </span>
                          )}
                          {item.stats.shares && (
                            <span className="flex items-center gap-1">
                              <Share2 className="w-4 h-4" />
                              {formatNumber(item.stats.shares)}
                            </span>
                          )}
                        </div>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(item.date).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </motion.a>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Featured Video Section */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Featured: SABC News Coverage
          </h2>
          
          <div className="bg-gray-900 rounded-2xl overflow-hidden aspect-video flex items-center justify-center">
            {/* This would be an embedded video player */}
            <div className="text-center text-white">
              <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 hover:bg-white/20 cursor-pointer transition">
                <Play className="w-10 h-10 ml-1" />
              </div>
              <p className="font-medium">SOA March Coverage - SABC News</p>
              <p className="text-sm text-gray-400 mt-1">Click to watch</p>
            </div>
          </div>

          <div className="mt-4 text-center">
            <p className="text-gray-600">
              The Soil of Africa leading the fight for employment rights in Mamelodi, Pretoria.
            </p>
            <a 
              href="https://twitter.com/SABCNews/status/1949862717621178383" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-soa-primary hover:underline mt-2 font-medium"
            >
              Watch on X/Twitter
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Submit Content CTA */}
      <section className="py-16 bg-gradient-to-br from-soa-primary to-soa-dark text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Share Your Story</h2>
          <p className="text-lg text-gray-200 mb-8">
            Are you a SOA member with content to share? Submit your photos, videos, 
            and testimonials to be featured on our media hub.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="https://wa.me/27762233981"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-soa-primary rounded-xl font-medium hover:bg-gray-100 transition"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Submit via WhatsApp
            </Link>
            <a
              href="mailto:media@soilofafrica.org?subject=Media Submission"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/10 text-white border border-white/30 rounded-xl font-medium hover:bg-white/20 transition"
            >
              Email Your Content
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
