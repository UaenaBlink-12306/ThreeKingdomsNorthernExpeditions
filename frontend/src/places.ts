export type PlaceId =
  | "chengdu"
  | "hanzhong"
  | "qishan"
  | "jieting"
  | "longyou"
  | "wuzhangyuan"
  | "changan";

export interface PlaceDef {
  id: PlaceId;
  name: string;
  lat: number;
  lng: number;
}

export const PLACE_ORDER: PlaceId[] = [
  "chengdu",
  "hanzhong",
  "qishan",
  "jieting",
  "longyou",
  "wuzhangyuan",
  "changan",
];

export const PLACES: PlaceDef[] = [
  { id: "chengdu", name: "成都", lat: 30.5728, lng: 104.0668 },
  { id: "hanzhong", name: "汉中", lat: 33.0676, lng: 107.0238 },
  { id: "qishan", name: "祁山", lat: 34.4432, lng: 107.6245 },
  { id: "jieting", name: "街亭", lat: 34.5693, lng: 105.7333 },
  { id: "longyou", name: "陇右", lat: 34.9485, lng: 104.9854 },
  { id: "wuzhangyuan", name: "五丈原", lat: 34.2776, lng: 107.7585 },
  { id: "changan", name: "长安", lat: 34.3416, lng: 108.9398 },
];

export const PLACE_MAP: Record<string, PlaceDef> = Object.fromEntries(
  PLACES.map((place) => [place.id, place])
);
