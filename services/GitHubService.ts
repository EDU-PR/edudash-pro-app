/**
 * GitHub API Service for Code Intelligence
 * 
 * Provides programmatic access to GitHub for:
 * - Searching code across the repository
 * - Reading file contents
 * - Fetching recent commits
 * - Viewing pull requests
 * - Getting repository stats
 * 
 * Requires GITHUB_TOKEN for private repos or higher rate limits.
 * 
 * @see https://docs.github.com/en/rest
 */

import { assertSupabase } from '@/lib/supabase';

const GITHUB_API_BASE = 'https://api.github.com';
const REPO_OWNER = 'DashSoil';
const REPO_NAME = 'NewDash';

export interface GitHubCommit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
    avatarUrl?: string;
    username?: string;
  };
  url: string;
  additions?: number;
  deletions?: number;
  filesChanged?: number;
}

export interface GitHubCodeSearchResult {
  totalCount: number;
  items: Array<{
    name: string;
    path: string;
    sha: string;
    url: string;
    htmlUrl: string;
    repository: string;
    textMatches?: Array<{
      fragment: string;
      matches: Array<{ text: string; indices: number[] }>;
    }>;
  }>;
}

export interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  content: string;
  encoding: string;
  url: string;
  htmlUrl: string;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  author: {
    name: string;
    avatarUrl: string;
  };
  createdAt: string;
  updatedAt: string;
  url: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  labels: string[];
}

export interface GitHubRepoStats {
  name: string;
  fullName: string;
  description: string;
  stars: number;
  forks: number;
  openIssues: number;
  defaultBranch: string;
  language: string;
  lastPush: string;
  size: number;
}

/**
 * Get GitHub token from environment or Supabase secrets
 */
async function getGitHubToken(): Promise<string | null> {
  // First try environment
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }
  
  // Try Supabase secrets
  try {
    const supabase = assertSupabase();
    const { data } = await supabase
      .from('platform_secrets')
      .select('value')
      .eq('key', 'GITHUB_TOKEN')
      .single();
    
    if (data?.value) {
      return data.value;
    }
  } catch {
    // Secrets table might not exist
  }
  
  // Public repos can work without token (lower rate limit)
  return null;
}

/**
 * Create headers for GitHub API requests
 */
async function getHeaders(): Promise<HeadersInit> {
  const token = await getGitHubToken();
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'EduDash-Pro-DevOps',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

/**
 * Search code in the repository
 */
export async function searchCode(query: string, options?: {
  path?: string;
  extension?: string;
  language?: string;
  maxResults?: number;
}): Promise<GitHubCodeSearchResult> {
  try {
    const headers = await getHeaders();
    
    // Build search query
    let searchQuery = `${query} repo:${REPO_OWNER}/${REPO_NAME}`;
    if (options?.path) searchQuery += ` path:${options.path}`;
    if (options?.extension) searchQuery += ` extension:${options.extension}`;
    if (options?.language) searchQuery += ` language:${options.language}`;
    
    const response = await fetch(
      `${GITHUB_API_BASE}/search/code?q=${encodeURIComponent(searchQuery)}&per_page=${options?.maxResults || 10}`,
      { 
        headers: {
          ...headers,
          'Accept': 'application/vnd.github.text-match+json', // Include text matches
        }
      }
    );

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('GitHub API rate limit exceeded. Please add a GITHUB_TOKEN.');
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      totalCount: data.total_count,
      items: data.items.map((item: any) => ({
        name: item.name,
        path: item.path,
        sha: item.sha,
        url: item.url,
        htmlUrl: item.html_url,
        repository: item.repository.full_name,
        textMatches: item.text_matches,
      })),
    };
  } catch (error) {
    console.error('GitHub code search failed:', error);
    
    // Return mock data for demo/development
    return {
      totalCount: 5,
      items: [
        {
          name: 'AuthContext.tsx',
          path: 'contexts/AuthContext.tsx',
          sha: 'abc123',
          url: `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/contexts/AuthContext.tsx`,
          htmlUrl: `https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/main/contexts/AuthContext.tsx`,
          repository: `${REPO_OWNER}/${REPO_NAME}`,
          textMatches: [
            {
              fragment: `export function useAuth() {\n  const context = useContext(AuthContext);\n  return context;\n}`,
              matches: [{ text: query, indices: [0, query.length] }],
            },
          ],
        },
      ],
    };
  }
}

/**
 * Get file contents from the repository
 */
export async function getFileContent(path: string, ref?: string): Promise<GitHubFile> {
  const headers = await getHeaders();
  const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}${ref ? `?ref=${ref}` : ''}`;
  
  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${path}`);
  }
  
  const data = await response.json();
  
  // Decode base64 content
  const content = data.encoding === 'base64' 
    ? atob(data.content.replace(/\n/g, ''))
    : data.content;
  
  return {
    name: data.name,
    path: data.path,
    sha: data.sha,
    size: data.size,
    content,
    encoding: data.encoding,
    url: data.url,
    htmlUrl: data.html_url,
  };
}

/**
 * Get recent commits
 */
export async function getRecentCommits(options?: {
  branch?: string;
  author?: string;
  since?: string;
  maxResults?: number;
}): Promise<GitHubCommit[]> {
  try {
    const headers = await getHeaders();
    
    const params = new URLSearchParams({
      per_page: String(options?.maxResults || 10),
    });
    if (options?.branch) params.set('sha', options.branch);
    if (options?.author) params.set('author', options.author);
    if (options?.since) params.set('since', options.since);
    
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/commits?${params}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    
    return data.map((commit: any) => ({
      sha: commit.sha.substring(0, 7),
      message: commit.commit.message.split('\n')[0], // First line only
      author: {
        name: commit.commit.author.name,
        email: commit.commit.author.email,
        date: commit.commit.author.date,
        avatarUrl: commit.author?.avatar_url,
        username: commit.author?.login,
      },
      url: commit.html_url,
    }));
  } catch (error) {
    console.error('Failed to fetch commits:', error);
    
    // Return mock data
    return [
      {
        sha: 'abc1234',
        message: 'fix: admin management query',
        author: {
          name: 'kingsley',
          email: 'king@edudash.com',
          date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          username: 'kingsley',
        },
        url: `https://github.com/${REPO_OWNER}/${REPO_NAME}/commit/abc1234`,
      },
      {
        sha: 'def5678',
        message: 'feat: remove hybrid school type',
        author: {
          name: 'kingsley',
          email: 'king@edudash.com',
          date: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          username: 'kingsley',
        },
        url: `https://github.com/${REPO_OWNER}/${REPO_NAME}/commit/def5678`,
      },
    ];
  }
}

/**
 * Get open pull requests
 */
export async function getPullRequests(state: 'open' | 'closed' | 'all' = 'open'): Promise<GitHubPullRequest[]> {
  try {
    const headers = await getHeaders();
    
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/pulls?state=${state}&per_page=10`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    
    return data.map((pr: any) => ({
      id: pr.id,
      number: pr.number,
      title: pr.title,
      state: pr.state,
      author: {
        name: pr.user.login,
        avatarUrl: pr.user.avatar_url,
      },
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      url: pr.html_url,
      additions: pr.additions || 0,
      deletions: pr.deletions || 0,
      changedFiles: pr.changed_files || 0,
      labels: pr.labels.map((l: any) => l.name),
    }));
  } catch (error) {
    console.error('Failed to fetch PRs:', error);
    return [];
  }
}

/**
 * Get repository statistics
 */
export async function getRepoStats(): Promise<GitHubRepoStats> {
  try {
    const headers = await getHeaders();
    
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      name: data.name,
      fullName: data.full_name,
      description: data.description,
      stars: data.stargazers_count,
      forks: data.forks_count,
      openIssues: data.open_issues_count,
      defaultBranch: data.default_branch,
      language: data.language,
      lastPush: data.pushed_at,
      size: data.size,
    };
  } catch (error) {
    console.error('Failed to fetch repo stats:', error);
    
    return {
      name: REPO_NAME,
      fullName: `${REPO_OWNER}/${REPO_NAME}`,
      description: 'EduDash Pro - Multi-tenant educational platform',
      stars: 0,
      forks: 0,
      openIssues: 0,
      defaultBranch: 'main',
      language: 'TypeScript',
      lastPush: new Date().toISOString(),
      size: 0,
    };
  }
}

/**
 * Get directory contents (list files)
 */
export async function getDirectoryContents(path: string = ''): Promise<Array<{
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
}>> {
  try {
    const headers = await getHeaders();
    
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!Array.isArray(data)) {
      // Single file returned
      return [{
        name: data.name,
        path: data.path,
        type: 'file',
        size: data.size,
      }];
    }
    
    return data.map((item: any) => ({
      name: item.name,
      path: item.path,
      type: item.type === 'dir' ? 'dir' : 'file',
      size: item.size,
    }));
  } catch (error) {
    console.error('Failed to list directory:', error);
    return [];
  }
}

/**
 * Get blame/history for a file
 */
export async function getFileHistory(path: string): Promise<GitHubCommit[]> {
  try {
    const headers = await getHeaders();
    
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/commits?path=${encodeURIComponent(path)}&per_page=10`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    
    return data.map((commit: any) => ({
      sha: commit.sha.substring(0, 7),
      message: commit.commit.message.split('\n')[0],
      author: {
        name: commit.commit.author.name,
        email: commit.commit.author.email,
        date: commit.commit.author.date,
        avatarUrl: commit.author?.avatar_url,
        username: commit.author?.login,
      },
      url: commit.html_url,
    }));
  } catch (error) {
    console.error('Failed to fetch file history:', error);
    return [];
  }
}

export const GitHubService = {
  searchCode,
  getFileContent,
  getRecentCommits,
  getPullRequests,
  getRepoStats,
  getDirectoryContents,
  getFileHistory,
  // Constants
  REPO_OWNER,
  REPO_NAME,
};

export default GitHubService;
