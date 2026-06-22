import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { Graph } from "../types";

interface Props {
  graph: Graph;
  path: string[];
  onSelect: (id: string) => void;
}

export default function KnowledgeGraph({ graph, path, onSelect }: Props) {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const W = 760;
    const H = 520;
    const PAD = 40;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    const pathSet = new Set(path);

    const nodes = graph.points.map((p) => ({ ...p })) as any[];
    const links = graph.edges.map(([s, t]) => ({ source: s, target: t })) as any[];

    const onPath = (d: any) => {
      const s = d.source.id ?? d.source;
      const t = d.target.id ?? d.target;
      return pathSet.has(s) && pathSet.has(t);
    };

    const sim = d3
      .forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(95))
      .force("charge", d3.forceManyBody().strength(-340))
      .force("center", d3.forceCenter(W / 2, H / 2))
      .force("x", d3.forceX(W / 2).strength(0.06))
      .force("y", d3.forceY(H / 2).strength(0.06))
      .force("collide", d3.forceCollide(40));

    const link = svg
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", (d: any) => (onPath(d) ? "#7c3aed" : "#e2e8f0"))
      .attr("stroke-width", (d: any) => (onPath(d) ? 3 : 1.5));

    const node = svg
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .style("cursor", "pointer")
      .on("click", (_e, d: any) => onSelect(d.id));

    node
      .append("circle")
      .attr("r", 18)
      .attr("fill", (d: any) => (pathSet.has(d.id) ? "#7c3aed" : "#f5f3ff"))
      .attr("stroke", (d: any) => (pathSet.has(d.id) ? "#7c3aed" : "#ddd6fe"))
      .attr("stroke-width", 1.5);

    // 标签放在圆圈下方，避免长名称（如“查找与哈希”）溢出
    node
      .append("text")
      .text((d: any) => d.name)
      .attr("text-anchor", "middle")
      .attr("dy", 33)
      .attr("font-size", 12)
      .attr("font-weight", (d: any) => (pathSet.has(d.id) ? "bold" : "normal"))
      .attr("fill", (d: any) => (pathSet.has(d.id) ? "#6d28d9" : "#475569"));

    sim.on("tick", () => {
      // 夹住坐标，确保节点与下方标签都不会被裁剪
      nodes.forEach((d: any) => {
        d.x = Math.max(PAD, Math.min(W - PAD, d.x));
        d.y = Math.max(PAD, Math.min(H - PAD - 16, d.y));
      });
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);
      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      sim.stop();
    };
  }, [graph, path, onSelect]);

  return (
    <svg
      ref={ref}
      width="100%"
      height="520"
      viewBox="0 0 760 520"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block" }}
    />
  );
}
