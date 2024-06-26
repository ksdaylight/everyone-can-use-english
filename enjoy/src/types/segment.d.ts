type SegmentType = {
  id: string;
  targetId: string;
  targetType: string;
  caption: TimelineEntry;
  audio?: AudioType;
  video?: VideoType;
  segmentIndex: number;
  md5: string;
  caption: TimeLIne;
  startTime: number;
  endTime: number;
  src: string;
  isSynced?: boolean;
  isUploaded?: boolean;
  syncedAt?: Date;
  uploadedAt?: Date
  updatedAt: Date
  createdAt: Date
};