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
    const W = 640;
    const H = 420;
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
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(90))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(W / 2, H / 2));

    const link = svg
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", (d: any) => (onPath(d) ? "#3b82f6" : "#cbd5e1"))
      .attr("stroke-width", (d: any) => (onPath(d) ? 3 : 1));

    const node = svg
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .style("cursor", "pointer")
      .on("click", (_e, d: any) => onSelect(d.id));

    node
      .append("circle")
      .attr("r", 22)
      .attr("fill", (d: any) => (pathSet.has(d.id) ? "#3b82f6" : "#e2e8f0"))
      .attr("stroke", "#94a3b8");

    node
      .append("text")
      .text((d: any) => d.name)
      .attr("text-anchor", "middle")
      .attr("dy", 4)
      .attr("font-size", 11)
      .attr("fill", (d: any) => (pathSet.has(d.id) ? "white" : "#334155"));

    sim.on("tick", () => {
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

  return <svg ref={ref} width="100%" height="420" viewBox="0 0 640 420" />;
}
