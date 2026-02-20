import type { PlaceId } from "./places";

export type RouteId =
  | "hanzhong_to_jieting"
  | "jieting_to_longyou"
  | "longyou_ops"
  | "longyou_to_qishan"
  | "qishan_to_wuzhangyuan"
  | "wuzhangyuan_ops"
  | "wuzhangyuan_to_changan"
  | "changan_ops";

export interface RouteDef {
  id: RouteId;
  points: [number, number][];
  from_place: PlaceId;
  to_place: PlaceId;
}

export const ROUTES: RouteDef[] = [
  {
    id: "hanzhong_to_jieting",
    from_place: "hanzhong",
    to_place: "jieting",
    points: [
      [33.0676, 107.0238],
      [33.6208, 106.4833],
      [34.1808, 106.0512],
      [34.5693, 105.7333],
    ],
  },
  {
    id: "jieting_to_longyou",
    from_place: "jieting",
    to_place: "longyou",
    points: [
      [34.5693, 105.7333],
      [34.7812, 105.3984],
      [34.9123, 105.1719],
      [34.9485, 104.9854],
    ],
  },
  {
    id: "longyou_ops",
    from_place: "longyou",
    to_place: "longyou",
    points: [
      [34.9485, 104.9854],
      [35.0361, 104.9018],
      [34.9819, 105.0641],
      [34.9485, 104.9854],
    ],
  },
  {
    id: "longyou_to_qishan",
    from_place: "longyou",
    to_place: "qishan",
    points: [
      [34.9485, 104.9854],
      [34.7914, 105.7895],
      [34.6114, 106.6129],
      [34.4432, 107.6245],
    ],
  },
  {
    id: "qishan_to_wuzhangyuan",
    from_place: "qishan",
    to_place: "wuzhangyuan",
    points: [
      [34.4432, 107.6245],
      [34.4178, 107.6938],
      [34.3479, 107.7302],
      [34.2776, 107.7585],
    ],
  },
  {
    id: "wuzhangyuan_ops",
    from_place: "wuzhangyuan",
    to_place: "wuzhangyuan",
    points: [
      [34.2776, 107.7585],
      [34.3182, 107.7049],
      [34.2465, 107.7098],
      [34.2776, 107.7585],
    ],
  },
  {
    id: "wuzhangyuan_to_changan",
    from_place: "wuzhangyuan",
    to_place: "changan",
    points: [
      [34.2776, 107.7585],
      [34.3305, 108.1027],
      [34.3492, 108.5224],
      [34.3416, 108.9398],
    ],
  },
  {
    id: "changan_ops",
    from_place: "changan",
    to_place: "changan",
    points: [
      [34.3416, 108.9398],
      [34.3823, 108.9847],
      [34.3024, 108.9981],
      [34.3416, 108.9398],
    ],
  },
];

export const ROUTE_MAP: Record<string, RouteDef> = Object.fromEntries(
  ROUTES.map((route) => [route.id, route])
);
