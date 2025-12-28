/**
 * Social Media API Integration
 * Fetches content from Twitter/X, Instagram, Facebook, and TikTok
 * 
 * Note: Most social media APIs require authentication and have rate limits.
 * For production, consider using third-party services like:
 * - Social media aggregators (Hootsuite, Buffer, etc.)
 * - RSS feeds where available
 * - Manual curation for important content
 */

export interface SocialMediaPost {
  id: string;
  platform: 'twitter' | 'instagram' | 'facebook' | 'tiktok';
  type: 'video' | 'image' | 'post';
  title: string;
  description: string;
  thumbnail?: string;
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

/**
 * Twitter/X API Integration
 * 
 * Note: Twitter API v2 requires:
 * - Bearer Token (for read-only access)
 * - API Key + Secret (for authenticated requests)
 * - Academic Research access for full historical data
 * 
 * Free tier: Very limited (1,500 tweets/month)
 * Paid tier: $100/month for basic access
 */
export async function fetchTwitterPosts(
  username: string = 'soilofafricasa',
  maxResults: number = 10
): Promise<SocialMediaPost[]> {
  const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
  
  if (!TWITTER_BEARER_TOKEN) {
    console.warn('Twitter Bearer Token not configured');
    return [];
  }

  try {
    // Get user ID first
    const userResponse = await fetch(
      `https://api.twitter.com/2/users/by/username/${username}`,
      {
        headers: {
          'Authorization': `Bearer ${TWITTER_BEARER_TOKEN}`,
        },
      }
    );

    if (!userResponse.ok) {
      throw new Error(`Twitter API error: ${userResponse.statusText}`);
    }

    const userData = await userResponse.json();
    const userId = userData.data?.id;

    if (!userId) {
      throw new Error('Twitter user not found');
    }

    // Get user's tweets
    const tweetsResponse = await fetch(
      `https://api.twitter.com/2/users/${userId}/tweets?max_results=${maxResults}&tweet.fields=created_at,public_metrics,attachments&expansions=attachments.media_keys&media.fields=type,url,preview_image_url`,
      {
        headers: {
          'Authorization': `Bearer ${TWITTER_BEARER_TOKEN}`,
        },
      }
    );

    if (!tweetsResponse.ok) {
      throw new Error(`Twitter API error: ${tweetsResponse.statusText}`);
    }

    const tweetsData = await tweetsResponse.json();
    
    return (tweetsData.data || []).map((tweet: any) => {
      const media = tweetsData.includes?.media || [];
      const tweetMedia = media.find((m: any) => 
        tweet.attachments?.media_keys?.includes(m.media_key)
      );

      return {
        id: tweet.id,
        platform: 'twitter' as const,
        type: tweetMedia?.type === 'video' ? 'video' as const : 'post' as const,
        title: tweet.text.substring(0, 100) + (tweet.text.length > 100 ? '...' : ''),
        description: tweet.text,
        thumbnail: tweetMedia?.preview_image_url || tweetMedia?.url,
        url: `https://twitter.com/${username}/status/${tweet.id}`,
        date: new Date(tweet.created_at).toISOString().split('T')[0],
        stats: {
          views: tweet.public_metrics?.impression_count,
          likes: tweet.public_metrics?.like_count,
          comments: tweet.public_metrics?.reply_count,
          shares: tweet.public_metrics?.retweet_count,
        },
      };
    });
  } catch (error) {
    console.error('Error fetching Twitter posts:', error);
    return [];
  }
}

/**
 * Instagram Basic Display API
 * 
 * Note: Instagram API requires:
 * - Facebook App setup
 * - User access token
 * - Limited to user's own content (not other accounts)
 * 
 * For public content, consider:
 * - Instagram Graph API (requires business/creator account)
 * - Web scraping (against ToS, not recommended)
 * - Manual curation
 */
export async function fetchInstagramPosts(
  username: string = 'soilofafrica',
  maxResults: number = 10
): Promise<SocialMediaPost[]> {
  const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
  
  if (!INSTAGRAM_ACCESS_TOKEN) {
    console.warn('Instagram Access Token not configured');
    return [];
  }

  try {
    // Instagram Graph API requires a business/creator account
    // This is a placeholder - actual implementation depends on account type
    const response = await fetch(
      `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=${maxResults}&access_token=${INSTAGRAM_ACCESS_TOKEN}`
    );

    if (!response.ok) {
      throw new Error(`Instagram API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return (data.data || []).map((post: any) => ({
      id: post.id,
      platform: 'instagram' as const,
      type: post.media_type === 'VIDEO' ? 'video' as const : 'image' as const,
      title: post.caption?.substring(0, 100) || 'Instagram Post',
      description: post.caption || '',
      thumbnail: post.thumbnail_url || post.media_url,
      url: post.permalink,
      date: new Date(post.timestamp).toISOString().split('T')[0],
      stats: {
        likes: post.like_count,
        comments: post.comments_count,
      },
    }));
  } catch (error) {
    console.error('Error fetching Instagram posts:', error);
    return [];
  }
}

/**
 * Facebook Graph API
 * 
 * Note: Facebook API requires:
 * - Facebook App setup
 * - Page access token
 * - App review for public content access
 */
export async function fetchFacebookPosts(
  pageId: string = '61575839187032',
  maxResults: number = 10
): Promise<SocialMediaPost[]> {
  const FACEBOOK_ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
  
  if (!FACEBOOK_ACCESS_TOKEN) {
    console.warn('Facebook Access Token not configured');
    return [];
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${pageId}/posts?fields=id,message,created_time,attachments{media,subattachments},reactions.summary(true),comments.summary(true),shares&limit=${maxResults}&access_token=${FACEBOOK_ACCESS_TOKEN}`
    );

    if (!response.ok) {
      throw new Error(`Facebook API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return (data.data || []).map((post: any) => {
      const media = post.attachments?.data?.[0]?.media || post.attachments?.data?.[0]?.subattachments?.data?.[0]?.media;
      
      return {
        id: post.id,
        platform: 'facebook' as const,
        type: media?.type === 'video' ? 'video' as const : 'image' as const,
        title: post.message?.substring(0, 100) || 'Facebook Post',
        description: post.message || '',
        thumbnail: media?.image?.src,
        url: `https://www.facebook.com/${pageId}/posts/${post.id.split('_')[1]}`,
        date: new Date(post.created_time).toISOString().split('T')[0],
        stats: {
          likes: post.reactions?.summary?.total_count,
          comments: post.comments?.summary?.total_count,
          shares: post.shares?.count,
        },
      };
    });
  } catch (error) {
    console.error('Error fetching Facebook posts:', error);
    return [];
  }
}

/**
 * TikTok API
 * 
 * Note: TikTok API is very limited:
 * - No official public API for fetching user content
 * - Requires TikTok for Developers account
 * - Limited to specific use cases
 * 
 * Alternatives:
 * - RSS feeds (if available)
 * - Manual curation
 * - Third-party services
 */
export async function fetchTikTokVideos(
  username: string = 'soilofafrica',
  maxResults: number = 10
): Promise<SocialMediaPost[]> {
  // TikTok doesn't have a public API for fetching user videos
  // This would require TikTok for Developers API (very limited access)
  console.warn('TikTok API not available - use manual curation or third-party service');
  return [];
}

/**
 * Fetch all social media content
 */
export async function fetchAllSocialMedia(maxResults: number = 10): Promise<SocialMediaPost[]> {
  const [twitter, instagram, facebook, tiktok] = await Promise.allSettled([
    fetchTwitterPosts('soilofafricasa', maxResults),
    fetchInstagramPosts('soilofafrica', maxResults),
    fetchFacebookPosts('61575839187032', maxResults),
    fetchTikTokVideos('soilofafrica', maxResults),
  ]);

  const allPosts: SocialMediaPost[] = [];
  
  if (twitter.status === 'fulfilled') allPosts.push(...twitter.value);
  if (instagram.status === 'fulfilled') allPosts.push(...instagram.value);
  if (facebook.status === 'fulfilled') allPosts.push(...facebook.value);
  if (tiktok.status === 'fulfilled') allPosts.push(...tiktok.value);

  // Sort by date (newest first)
  return allPosts.sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}


