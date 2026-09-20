import * as d3 from 'd3';
import data from './data.js';

const width = window.innerWidth;
const height = window.innerHeight;

const colors = {
  proposition: '#3498db',
  corollary: '#e67e22',
  scolie: '#9b59b6',
  definition: '#2ecc71',
  lemma: '#e74c3c',
  axiom: '#34495e',
  postulate: '#16a085'
};

function nodeId(node) {
  if (node.type === 'corollary' || node.type === 'scolie') {
    return `${node.type}:${node.number}:${node.parent.type}:${node.parent.number}:${node.part}`;
  }

  return `${node.type}:${node.number}:${node.part}`;
}

function referenceId(ref, part) {
  if (ref.type === 'corollary' || ref.type === 'scolie') {
    return `${ref.type}:${ref.number}:${ref.parent.type}:${ref.parent.number}:${ref.part ?? part}`;
  }

  return `${ref.type}:${ref.number}:${ref.part ?? part}`;
}

function buildGraph(data) {
  const nodes = [];
  const links = [];
  const nodeMap = new Map();

  function addNode(node) {
    const id = nodeId(node);

    if (!nodeMap.has(id)) {
      const graphNode = {
        id,
        type: node.type,
        number: node.number,
        part: node.part,
        text: node.text,
        parent: node.parent
      };

      nodeMap.set(id, graphNode);
      nodes.push(graphNode);
    }

    return id;
  }

  for (const item of data) {
    const sourceId = addNode(item);

    for (const ref of item.references ?? []) {
      const targetId = referenceId(ref, item.part);

      links.push({
        source: sourceId,
        target: targetId,
        type: 'reference'
      });

      if (!nodeMap.has(targetId)) {
        const target = {
          id: targetId,
          type: ref.type,
          number: ref.number,
          part: ref.part ?? item.part,
          parent: ref.parent,
          placeholder: true
        };

        nodeMap.set(targetId, target);
        nodes.push(target);
      }
    }

    if (item.parent) {
      const parentId = referenceId(
        {
          type: item.parent.type,
          number: item.parent.number,
          part: item.part
        },
        item.part
      );

      links.push({
        source: sourceId,
        target: parentId,
        type: 'parent'
      });

      if (!nodeMap.has(parentId)) {
        const parent = {
          id: parentId,
          type: item.parent.type,
          number: item.parent.number,
          part: item.part,
          placeholder: true
        };

        nodeMap.set(parentId, parent);
        nodes.push(parent);
      }
    }
  }

  return { nodes, links };
}

const graph = buildGraph(data);

const svg = d3
  .select('#graph')
  .append('svg')
  .attr('width', width)
  .attr('height', height);

svg
  .append('defs')
  .append('marker')
  .attr('id', 'arrow')
  .attr('viewBox', '0 -5 10 10')
  .attr('refX', 22)
  .attr('refY', 0)
  .attr('markerWidth', 7)
  .attr('markerHeight', 7)
  .attr('orient', 'auto')
  .append('path')
  .attr('d', 'M0,-5L10,0L0,5')
  .attr('fill', '#999');

const link = svg
  .append('g')
  .selectAll('line')
  .data(graph.links)
  .join('line')
  .attr('stroke', d =>
    d.type === 'parent' ? '#e67e22' : '#aaa'
  )
  .attr('stroke-width', 1.5)
  .attr('marker-end', 'url(#arrow)');

const node = svg
  .append('g')
  .selectAll('g')
  .data(graph.nodes)
  .join('g')
  .call(
    d3
      .drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended)
  );

node
  .append('circle')
  .attr('r', d => d.type === 'proposition' ? 10 : 7)
  .attr('fill', d => colors[d.type] || '#999');

node
  .append('text')
  .text(d => {
    if (d.type === 'proposition') return `P. ${d.number}`;
    if (d.type === 'corollary') return `C. ${d.number}`;
    if (d.type === 'scolie') return `S. ${d.number}`;

    return `${d.type} ${d.number}`;
  })
  .attr('x', 13)
  .attr('y', 4);

node
  .append('title')
  .text(d => d.text || `${d.type} ${d.number}`);

const simulation = d3
  .forceSimulation(graph.nodes)
  .force(
    'link',
    d3
      .forceLink(graph.links)
      .id(d => d.id)
      .distance(120)
  )
  .force('charge', d3.forceManyBody().strength(-300))
  .force(
    'center',
    d3.forceCenter(width / 2, height / 2)
  )
  .force(
    'collision',
    d3.forceCollide().radius(30)
  )
  .on('tick', () => {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    node.attr(
      'transform',
      d => `translate(${d.x},${d.y})`
    );
  });

function dragstarted(event, d) {
  if (!event.active) simulation.alphaTarget(0.3).restart();

  d.fx = d.x;
  d.fy = d.y;
}

function dragged(event, d) {
  d.fx = event.x;
  d.fy = event.y;
}

function dragended(event, d) {
  if (!event.active) simulation.alphaTarget(0);

  d.fx = null;
  d.fy = null;
}
