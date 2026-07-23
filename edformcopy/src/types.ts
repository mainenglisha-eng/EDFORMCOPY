export interface WorksheetField {
  id: string;
  type: 'text' | 'choice' | 'select' | 'audio' | 'video' | 'record-audio' | 'record-video';
  page: number; // 1-based page index
  x: number; // percentage coordinate (0-100)
  y: number; // percentage coordinate (0-100)
  width: number; // percentage width
  height: number; // percentage height
  correctAnswer: string; // correct response value or chosen option
  points: number; // points value for this field
  options: string[]; // options list (used by choice or select types)
  placeholder?: string; // custom hint
  mediaUrl?: string; // custom link to audio/video file or YouTube URL
  mediaEmbed?: string; // custom HTML iframe or embedded code
}

export interface Worksheet {
  id: string;
  title: string;
  backgrounds: string[]; // base64 or urls of the page images
  fields: WorksheetField[];
  createdAt: string;
  updatedAt: string;
}

export interface StudentSubmission {
  id: string;
  worksheetId: string;
  worksheetTitle: string;
  studentName: string;
  answers: Record<string, string>; // field.id -> student answer
  score: number;
  maxScore: number;
  submittedAt: string;
}
