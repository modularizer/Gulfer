//
//
// // ____________________________________________________________________________________________________
// import {OffsetClampAndScale} from "@services/scoring/offsetClampAndScale";
//
// export type RankToPointsMappingType = 'linear' | 'winner-loser' | 'checks';
// interface BaseRankToPointsMapping {
//     mode: RankToPointsMappingType;
// }
// export interface LinearRankToPointsMapping extends BaseRankToPointsMapping, OffsetClampAndScale {
//     mode: 'linear';
// }
// export interface WinnerLoserMapping extends BaseRankToPointsMapping {
//     winnerPoints?: (number[]) | number; // define points for 1, 2, 3, etc
//     loserPoints?: (number[]) | number; // define points for -1, -2, -3, etc.
//     middlePoints?: number; // for anyone else
// }
//
// export interface Check {
//     min?: number;
//     max?: number;
//     anyOf?: number;
//     points?: number;
// }
// export interface ChecksMapping extends BaseRankToPointsMapping {
//     mode: 'checks';
//     checks?: Check[];
//     checkMode?: 'first' | 'sum';
//     fallback?: number; // if all checks fail
// }
//
// export type RankToPointsMapping = LinearRankToPointsMapping | WinnerLoserMapping | ChecksMapping;
//
//
//
//
// export type RankMode = 'lowest' | 'highest';
//
// export interface ScoringMethod {
//     valueType: ValueTypes;
//     valueToNumMapping?: OffsetClampAndScale; // first do this
//     useRank?: boolean;
//     rankMode?: RankMode;
//     rankToPointsMapping?: OffsetClampAndScale
// }
//
