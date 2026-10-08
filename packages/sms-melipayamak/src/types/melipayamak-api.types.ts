export interface MelipayamakApiResponse<T = unknown> {
  Value: T;
  RetStatus: number;
  StrRetStatus: string;
}

export interface MelipayamakMessageItem {
  Location?: number;
  From?: string;
  To?: string;
  Text?: string;
  Date?: string;
  MsgID?: number | string;
}
