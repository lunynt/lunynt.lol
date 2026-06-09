export interface LanyardActivity {
  id: string;
  type: number;
  name: string;
  details?: string;
  state?: string;
  application_id?: string;
  assets?: {
    large_image?: string;
    large_text?: string;
  };
}

export interface LanyardData {
  discord_status: 'online' | 'idle' | 'dnd' | 'offline';
  listening_to_spotify: boolean;
  spotify?: {
    track_id: string;
    song: string;
    artist: string;
    album_art_url: string;
  } | null;
  activities: LanyardActivity[];
}

export const ACTIVITY_VERBS: Record<number, string> = {
  0: 'playing',
  1: 'streaming',
  3: 'watching',
  5: 'competing in',
};

export function resolveActivityImage(image: string, appId?: string): string {
  if (image.startsWith('mp:external/')) {
    const parts = image.slice('mp:external/'.length).split('/');
    if (parts.length < 3) return '';
    return `${parts[1]}://${parts.slice(2).join('/')}`;
  }
  if (appId) return `https://cdn.discordapp.com/app-assets/${appId}/${image}.png`;
  return '';
}

export function pickActivities(data: LanyardData): LanyardActivity[] {
  return data.activities.filter(a => ACTIVITY_VERBS[a.type] !== undefined);
}
