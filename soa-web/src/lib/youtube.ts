/**
 * YouTube API Integration
 * Fetches videos from the Soil of Africa YouTube channel
 */

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
  channelId: string;
  channelTitle: string;
  videoId: string;
  url: string;
  embedUrl: string;
  duration?: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
}

export interface YouTubeChannelInfo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  subscriberCount?: number;
  videoCount?: number;
  viewCount?: number;
}

const YOUTUBE_CHANNEL_ID = process.env.NEXT_PUBLIC_YOUTUBE_CHANNEL_ID || '@soilofafrica';
const YOUTUBE_API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;

/**
 * Extract channel ID from handle or URL
 */
function extractChannelId(identifier: string): string {
  // If it's already a channel ID (starts with UC)
  if (identifier.startsWith('UC')) {
    return identifier;
  }
  
  // If it's a handle (starts with @)
  if (identifier.startsWith('@')) {
    return identifier;
  }
  
  // If it's a URL, extract the ID
  const match = identifier.match(/(?:channel\/|user\/|@)([^\/\?]+)/);
  return match ? match[1] : identifier;
}

/**
 * Fetch videos from YouTube channel using YouTube Data API v3
 */
export async function fetchYouTubeVideos(
  maxResults: number = 12,
  order: 'date' | 'rating' | 'relevance' | 'title' | 'viewCount' = 'date'
): Promise<YouTubeVideo[]> {
  if (!YOUTUBE_API_KEY) {
    console.warn('YouTube API key not configured. Using fallback data.');
    return getFallbackVideos();
  }

  try {
    const channelId = extractChannelId(YOUTUBE_CHANNEL_ID);
    
    // First, get the channel ID if we have a handle
    let actualChannelId = channelId;
    if (channelId.startsWith('@')) {
      // For handles, use the handle directly in the search API
      // YouTube API v3 supports handles in search queries
      const handleName = channelId.slice(1); // Remove @
      
      // Try to get channel ID using search API
      const searchResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(channelId)}&key=${YOUTUBE_API_KEY}&maxResults=1`
      );
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.items?.[0]?.id?.channelId) {
          actualChannelId = searchData.items[0].id.channelId;
        } else if (searchData.items?.[0]?.snippet?.channelId) {
          actualChannelId = searchData.items[0].snippet.channelId;
        }
      }
      
      // If search didn't work, try channels.list with handle (newer API feature)
      if (actualChannelId === channelId) {
        try {
          const channelResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${handleName}&key=${YOUTUBE_API_KEY}`
          );
          
          if (channelResponse.ok) {
            const channelData = await channelResponse.json();
            if (channelData.items?.[0]?.id) {
              actualChannelId = channelData.items[0].id;
            }
          } else {
            // Log the error but don't fail - we'll try search query instead
            const errorData = await channelResponse.json().catch(() => ({}));
            console.warn('forHandle API not available or failed:', errorData.error?.message || channelResponse.statusText);
          }
        } catch (err) {
          // forHandle might not be supported in all API versions
          console.warn('forHandle API call failed, will use search query instead');
        }
      }
    }

    // If we still have a handle after resolution attempts, try using channels.list with forHandle
    if (actualChannelId.startsWith('@')) {
      const handleName = actualChannelId.slice(1);
      const channelListResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${handleName}&key=${YOUTUBE_API_KEY}`
      );
      
      if (channelListResponse.ok) {
        const channelListData = await channelListResponse.json();
        if (channelListData.items?.[0]?.id) {
          actualChannelId = channelListData.items[0].id;
        }
      }
    }

    // If we still have a handle, fall back to search by query
    let searchUrl: string;
    if (actualChannelId.startsWith('@')) {
      // Use search with channel handle in query
      searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(actualChannelId)}&type=video&order=${order}&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`;
    } else {
      // Use channelId parameter (most reliable)
      searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${actualChannelId}&type=video&order=${order}&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`;
    }

    // Fetch videos from the channel
    const response = await fetch(searchUrl);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || response.statusText;
      const errorDetails = errorData.error?.errors?.[0]?.message || '';
      console.error('YouTube API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData.error,
        channelId: actualChannelId,
        apiKey: YOUTUBE_API_KEY ? 'Set' : 'Missing'
      });
      throw new Error(`YouTube API error: ${errorMessage} ${errorDetails ? `- ${errorDetails}` : ''}`);
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      console.warn('No videos found for channel:', actualChannelId);
      return getFallbackVideos();
    }

    // Filter out items without videoId (shouldn't happen with type=video, but safety check)
    const validItems = data.items.filter((item: any) => item.id?.videoId);
    
    if (validItems.length === 0) {
      console.warn('No valid video items found');
      return getFallbackVideos();
    }

    // Get video statistics
    const videoIds = validItems.map((item: any) => item.id.videoId).join(',');
    const statsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${videoIds}&key=${YOUTUBE_API_KEY}`
    );

    let statsData: any = { items: [] };
    if (statsResponse.ok) {
      statsData = await statsResponse.json();
    }

    const statsMap = new Map(
      statsData.items?.map((item: any) => [
        item.id,
        {
          viewCount: parseInt(item.statistics?.viewCount || '0'),
          likeCount: parseInt(item.statistics?.likeCount || '0'),
          commentCount: parseInt(item.statistics?.commentCount || '0'),
          duration: item.contentDetails?.duration,
        },
      ]) || []
    );

    return validItems.map((item: any) => {
      const videoId = item.id.videoId;
      const stats = statsMap.get(videoId) || {};
      
      return {
        id: videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
        publishedAt: item.snippet.publishedAt,
        channelId: item.snippet.channelId,
        channelTitle: item.snippet.channelTitle,
        videoId: videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
        viewCount: stats.viewCount,
        likeCount: stats.likeCount,
        commentCount: stats.commentCount,
        duration: stats.duration,
      };
    });
  } catch (error: any) {
    console.error('Error fetching YouTube videos:', error);
    console.error('Error details:', {
      message: error.message,
      channelId: YOUTUBE_CHANNEL_ID,
      hasApiKey: !!YOUTUBE_API_KEY,
    });
    // Return fallback videos on any error
    return getFallbackVideos();
  }
}

/**
 * Fetch channel information
 */
export async function fetchYouTubeChannelInfo(): Promise<YouTubeChannelInfo | null> {
  if (!YOUTUBE_API_KEY) {
    return null;
  }

  try {
    const channelId = extractChannelId(YOUTUBE_CHANNEL_ID);
    let actualChannelId = channelId;

    if (channelId.startsWith('@')) {
      const channelResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${channelId.slice(1)}&key=${YOUTUBE_API_KEY}`
      );
      
      if (channelResponse.ok) {
        const channelData = await channelResponse.json();
        if (channelData.items?.[0]?.id) {
          actualChannelId = channelData.items[0].id;
        }
      }
    }

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${actualChannelId}&key=${YOUTUBE_API_KEY}`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const channel = data.items?.[0];

    if (!channel) {
      return null;
    }

    return {
      id: channel.id,
      title: channel.snippet.title,
      description: channel.snippet.description,
      thumbnail: channel.snippet.thumbnails?.high?.url || channel.snippet.thumbnails?.default?.url,
      subscriberCount: parseInt(channel.statistics?.subscriberCount || '0'),
      videoCount: parseInt(channel.statistics?.videoCount || '0'),
      viewCount: parseInt(channel.statistics?.viewCount || '0'),
    };
  } catch (error) {
    console.error('Error fetching YouTube channel info:', error);
    return null;
  }
}

/**
 * Fallback videos when API is not available
 */
function getFallbackVideos(): YouTubeVideo[] {
  return [
    {
      id: '1',
      title: 'SOA March in Mamelodi',
      description: 'The Soil of Africa led a march in Mamelodi, east of Pretoria, to demand employment for SA citizens.',
      thumbnail: '/media/march-thumb.jpg',
      publishedAt: '2025-07-28T00:00:00Z',
      channelId: 'UC_soilofafrica',
      channelTitle: 'Soil of Africa',
      videoId: 'fallback-1',
      url: 'https://twitter.com/SABCNews/status/1949862717621178383',
      embedUrl: '',
      viewCount: 45000,
      likeCount: 2300,
      commentCount: 890,
    },
    {
      id: '2',
      title: 'Skills Development Programme Launch',
      description: 'Official launch of the skills development programme at Mamelodi Skills Centre.',
      thumbnail: '/media/skills-launch.jpg',
      publishedAt: '2025-06-15T00:00:00Z',
      channelId: 'UC_soilofafrica',
      channelTitle: 'Soil of Africa',
      videoId: 'fallback-2',
      url: 'https://www.youtube.com/@soilofafrica',
      embedUrl: '',
      viewCount: 12500,
      likeCount: 890,
      commentCount: 156,
    },
  ];
}

/**
 * Format duration from ISO 8601 format (PT4M13S) to readable format
 */
export function formatDuration(duration: string): string {
  if (!duration) return '';
  
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '';
  
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

