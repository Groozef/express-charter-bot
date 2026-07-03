export interface SourceMedia {
  buffer: Buffer;
  isPhoto: boolean;
  filename?: string;
}

export interface SourceMessage {
  id: number;
  date: number;
  text: string;
  media?: SourceMedia;
}
