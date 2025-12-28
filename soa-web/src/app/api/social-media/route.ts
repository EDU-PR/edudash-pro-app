import { NextResponse } from 'next/server';
import { fetchAllSocialMedia, fetchTwitterPosts, fetchInstagramPosts, fetchFacebookPosts } from '@/lib/socialMedia';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform');
  const maxResults = parseInt(searchParams.get('maxResults') || '10');

  try {
    let posts;

    if (platform) {
      switch (platform) {
        case 'twitter':
          posts = await fetchTwitterPosts('soilofafricasa', maxResults);
          break;
        case 'instagram':
          posts = await fetchInstagramPosts('soilofafrica', maxResults);
          break;
        case 'facebook':
          posts = await fetchFacebookPosts('61575839187032', maxResults);
          break;
        default:
          posts = await fetchAllSocialMedia(maxResults);
      }
    } else {
      posts = await fetchAllSocialMedia(maxResults);
    }

    return NextResponse.json(posts);
  } catch (error: any) {
    console.error('Social media API error:', error);
    // Return empty array to allow fallback content
    return NextResponse.json([]);
  }
}


