export type PresenceStatus = "online" | "idle" | "dnd" | "offline";

export interface LanyardActivityAssets {
  large_image?: string;
  large_text?: string;
  small_image?: string;
  small_text?: string;
}

export interface LanyardActivity {
  type: number;
  name: string;
  details?: string;
  state?: string;
  application_id?: string;
  emoji?: { name: string; id?: string } | null;
  assets?: LanyardActivityAssets;
  timestamps?: { start?: number; end?: number };
}

export interface LanyardSpotify {
  song: string;
  artist: string;
  album: string;
  album_art_url: string;
  timestamps?: { start?: number; end?: number };
}

export interface LanyardData {
  discord_status: PresenceStatus;
  activities: LanyardActivity[];
  listening_to_spotify: boolean;
  spotify: LanyardSpotify | null;
}

export interface NormalizedEmoji {
  name: string;
  id: string | null;
}

export interface NormalizedCustomStatus {
  text: string;
  emoji: NormalizedEmoji | null;
}

export interface NormalizedActivity {
  key: string;
  source: "spotify" | "activity";
  header: string;
  title: string | null;
  subtitle: string | null;
  art: string | null;
  start: number | null;
  end: number | null;
}

export interface NormalizedPresence {
  status: PresenceStatus;
  customStatus: NormalizedCustomStatus | null;
  activities: NormalizedActivity[];
}

const ACTIVITY_LABEL: Record<number, string> = {
  0: "Playing",
  1: "Streaming",
  2: "Listening to",
  3: "Watching",
  4: "Custom status",
  5: "Competing in",
};

function resolveAsset(
  applicationId: string | undefined,
  image: string | undefined,
): string | null {
  if (!image) {
    return null;
  }

  if (/^https?:\/\//.test(image)) {
    return image;
  }

  const spotifyImage = image.match(/^spotify:image:(.+)$/);
  if (spotifyImage) {
    return `https://i.scdn.co/image/${spotifyImage[1]}`;
  }

  if (image.startsWith("mp:external/")) {
    const rest = image.slice("mp:external/".length);
    const match = rest.match(/\/(https?)\/(.+)$/);
    return match ? `${match[1]}://${match[2]}` : null;
  }

  if (image.startsWith("mp:")) {
    return null;
  }

  if (applicationId) {
    return `https://cdn.discordapp.com/app-assets/${applicationId}/${image}.png`;
  }

  return null;
}

function readTimestamp(
  value: { start?: number; end?: number } | undefined,
  key: "start" | "end",
): number | null {
  const raw = value?.[key];
  return typeof raw === "number" ? raw : null;
}

export async function fetchLanyard(id: string): Promise<LanyardData | null> {
  if (!id) {
    return null;
  }

  try {
    const response = await fetch(`https://api.lanyard.rest/v1/users/${id}`);
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      success: boolean;
      data?: LanyardData;
    };

    return payload.success && payload.data ? payload.data : null;
  } catch {
    return null;
  }
}

export function normalizePresence(data: LanyardData): NormalizedPresence {
  const activities: NormalizedActivity[] = [];
  let customStatus: NormalizedCustomStatus | null = null;

  if (data.listening_to_spotify && data.spotify) {
    activities.push({
      key: "spotify",
      source: "spotify",
      header: "Listening to Spotify",
      title: data.spotify.song,
      subtitle: data.spotify.artist,
      art: data.spotify.album_art_url,
      start: readTimestamp(data.spotify.timestamps, "start"),
      end: readTimestamp(data.spotify.timestamps, "end"),
    });
  }

  (data.activities ?? []).forEach((activity) => {
    if (activity.type === 4) {
      const text = activity.state?.trim() ?? "";
      const emoji = activity.emoji?.name
        ? { name: activity.emoji.name, id: activity.emoji.id ?? null }
        : null;

      if (text || emoji) {
        customStatus = { text, emoji };
      }
      return;
    }

    if (activity.name === "Spotify" && data.listening_to_spotify) {
      return;
    }

    activities.push({
      key: `activity:${activity.type}:${activity.name}:${activity.application_id ?? ""}`,
      source: "activity",
      header: `${ACTIVITY_LABEL[activity.type] ?? "Playing"} ${activity.name}`,
      title: activity.details ?? null,
      subtitle: activity.state ?? null,
      art:
        resolveAsset(activity.application_id, activity.assets?.large_image) ??
        resolveAsset(activity.application_id, activity.assets?.small_image),
      start: readTimestamp(activity.timestamps, "start"),
      end: readTimestamp(activity.timestamps, "end"),
    });
  });

  return {
    status: data.discord_status,
    customStatus,
    activities,
  };
}
