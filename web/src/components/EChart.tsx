import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { LineChart, HeatmapChart } from "echarts/charts";
import {
  GridComponent, TooltipComponent, LegendComponent, VisualMapComponent, CalendarComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";

echarts.use([
  LineChart, HeatmapChart,
  GridComponent, TooltipComponent, LegendComponent, VisualMapComponent, CalendarComponent,
  CanvasRenderer,
]);

// Wrapper ECharts tối giản: init 1 lần, setOption khi option đổi, tự resize.
export function EChart({ option, height = 280 }: { option: EChartsOption; height?: number | string }) {
  const el = useRef<HTMLDivElement>(null);
  const inst = useRef<ReturnType<typeof echarts.init> | null>(null);

  useEffect(() => {
    if (!el.current) return;
    inst.current = echarts.init(el.current, undefined, { renderer: "canvas" });
    const onResize = () => inst.current?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      inst.current?.dispose();
      inst.current = null;
    };
  }, []);

  useEffect(() => {
    inst.current?.setOption(option, true);
  }, [option]);

  return <div ref={el} style={{ width: "100%", height }} />;
}

// Bảng màu dùng chung cho chart (đồng bộ design token Nón Sơn).
export const CHART = {
  gold: "#CBA45A",
  teal: "#3FB6A8",
  ink: "#E6EBF2",
  mut: "#8FA3BF",
  line: "#1E2A44",
  grid: "#16223C",
  danger: "#E5635B",
  info: "#5B9BD5",
};

export const AXIS_TEXT = { color: CHART.mut, fontSize: 11 };
