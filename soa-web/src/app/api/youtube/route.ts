import { NextResponse } from 'next/server';
import { fetchYouTubeVideos, fetchYouTubeChannelInfo } from '@/lib/youtube';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const maxResults = parseInt(searchParams.get('maxResults') || '12');
  const order = (searchParams.get('order') as 'date' | 'rating' | 'relevance' | 'title' | 'viewCount') || 'date';
  const type = searchParams.get('type') || 'videos';

  try {
    if (type === 'channel') {
      const channelInfo = await fetchYouTubeChannelInfo();
      return NextResponse.json(channelInfo);
    }

    const videos = await fetchYouTubeVideos(maxResults, order);
    return NextResponse.json(videos);
  } catch (error: any) {
    console.error('YouTube API error:', error);
    console.error('Error stack:', error.stack);
    // Return empty array instead of error to allow fallback content
    // This way the site still works even if YouTube API fails
    return NextResponse.json([]);
  }
}

