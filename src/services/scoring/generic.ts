export type PlayerId = string;
export type Value = any;

export type PlayerValues = Record<PlayerId, Value>;

export type PlayerResult = {
    value: Value;
    place: number;
    placeFromEnd: number;
    points: number;
    won: boolean;
    lost: boolean;
    scoreType: string; // e.g. 'hole-in-one', 'eagle','birdie'  or 'ace','three-pointer', etc. etc.
    stats: Record<string, any>;
}
export type GroupResult = {
    playerResults: Record<PlayerId, PlayerResult>;
    winners: PlayerId[];
    winningPoints: number;
    stats: Record<string, any>;
}
export type HoleMetadataType = string;
export type HoleMetadata = Record<HoleMetadataType, any>;


export type CourseInfo = HoleMetadata[];

export interface HoleScoringInfo  {
    playerValues: PlayerValues;
    previousHoleResults: GroupResult[];
    courseInfo: CourseInfo;
}

export type ScoreHole = (info: HoleScoringInfo) => GroupResult;

export interface RoundScoringInfo {
    holeResults: GroupResult[];
    courseInfo: CourseInfo;
}

export type ScoreRound = (info: RoundScoringInfo) => GroupResult;
