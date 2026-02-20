declare module "leaflet-ant-path" {
  import type * as L from "leaflet";

  export interface AntPathOptions extends L.PolylineOptions {
    paused?: boolean;
    reverse?: boolean;
    hardwareAccelerated?: boolean;
    pulseColor?: string;
    delay?: number;
    dashArray?: number[] | string;
  }

  export function antPath(
    latlngs: L.LatLngExpression[] | L.LatLngExpression[][],
    options?: AntPathOptions
  ): L.Polyline;
}
