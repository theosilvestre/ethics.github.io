import * as d3 from 'd3';
import data from '../data.js';

const colors = {
  proposition: '#4a90e2',
  corollary: '#f39c12',
  scolie: '#9b59b6',
  definition: '#27ae60',
  lemma: '#e74c3c',
  axiom: '#34495e',
  postulate: '#16a085'
};

const NODE_WIDTH = 300;
const HEADER_HEIGHT = 58;
const LINE_HEIGHT = 16;
const COLUMN_GAP = 100;
const ROW_GAP = 55;
const PART_GAP = 120;

const enabledTypes = new Set([
  'proposition',
  'corollary',
  'scolie',
  'definition',
  'lemma',
  'axiom',
  'postulate'
]);

const enabledParts = new Set([1, 2, 3, 4, 5]);

let selectedNode = null;

function nodeId(n) {
  const parent = n.parent
    ? `:${n.parent.type}:${n.parent.number}`
    : '';

  return `${n.type}:${n.number}:${n.part}${parent}`;
}

function nodeTitle(n) {
  const names = {
    proposition: 'Proposition',
    corollary: 'Corollaire',
    scolie: 'Scolie',
    definition: 'Définition',
    lemma: 'Lemme',
    axiom: 'Axiome',
    postulate: 'Postulat'
  };

  let title = `${names[n.type] || n.type} ${n.number}`;

  if (n.parent) {
    const parentType =
      n.parent.type === 'proposition'
        ? 'proposition'
        : ['lemma', 'lemme'].includes(n.parent.type)
          ? 'lemme'
          : n.parent.type;

    title += ` de la ${parentType} ${n.parent.number}`;
  }

  return title;
}

function wrapText(text, max = 43) {
  if (!text) return [];

  const lines = [];
  let line = '';

  for (const word of text.split(/\s+/)) {
    if (word.length > max) {
      if (line) {
        lines.push(line);
        line = '';
      }

      for (let i = 0; i < word.length; i += max) {
        lines.push(word.slice(i, i + max));
      }

      continue;
    }

    const candidate = line
      ? `${line} ${word}`
      : word;

    if (candidate.length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line) lines.push(line);

  return lines;
}

function buildGraph(data) {
  const nodes = [];
  const links = [];
  const map = new Map();

  function add(n, placeholder = false) {
    const id = nodeId(n);

    if (!map.has(id)) {
      const node = {
        id,
        type: n.type,
        number: n.number,
        part: n.part,
        text: n.text || '',
        demonstration: n.demonstration || [],
        references: n.references || [],
        parent: n.parent,
        placeholder
      };

      map.set(id, node);
      nodes.push(node);
    } else if (!placeholder) {
      Object.assign(map.get(id), n, {
        placeholder: false
      });
    }

    return id;
  }

  for (const item of data) {
    const source = add(item);

    for (const ref of item.references || []) {
      const referenced = add(
        {
          type: ref.type,
          number: ref.number,
          part: ref.part ?? item.part,
          parent: ref.parent
        },
        true
      );

      links.push({
        source: referenced,
        target: source,
        type: 'reference'
      });
    }

    if (item.parent) {
      const parent = add(
        {
          type: item.parent.type,
          number: item.parent.number,
          part: item.part
        },
        true
      );

      links.push({
        source: parent,
        target: source,
        type: 'parent'
      });
    }
  }

  return { nodes, links };
}

const graph = buildGraph(data);

const nodeById = new Map(
  graph.nodes.map(n => [n.id, n])
);

function calculateDistances() {
  if (!selectedNode) {
    return {
      ancestors: {},
      descendants: {}
    };
  }

  const incoming = new Map();
  const outgoing = new Map();

  for (const link of graph.links) {
    if (!incoming.has(link.target)) {
      incoming.set(link.target, []);
    }

    if (!outgoing.has(link.source)) {
      outgoing.set(link.source, []);
    }

    incoming.get(link.target).push(link.source);
    outgoing.get(link.source).push(link.target);
  }

  function walk(start, map) {
    const distances = {
      [start]: 0
    };

    const queue = [start];

    while (queue.length) {
      const current = queue.shift();

      for (const next of map.get(current) || []) {
        if (distances[next] === undefined) {
          distances[next] = distances[current] + 1;
          queue.push(next);
        }
      }
    }

    return distances;
  }

  return {
    ancestors: walk(selectedNode.id, incoming),
    descendants: walk(selectedNode.id, outgoing)
  };
}

const svg = d3
  .select('#graph')
  .append('svg')
  .attr('width', 1800);

const defs = svg.append('defs');

defs
  .append('marker')
  .attr('id', 'arrow')
  .attr('viewBox', '0 -5 10 10')
  .attr('refX', 9)
  .attr('refY', 0)
  .attr('markerWidth', 7)
  .attr('markerHeight', 7)
  .attr('orient', 'auto')
  .append('path')
  .attr('d', 'M0,-5L10,0L0,5')
  .attr('fill', 'currentColor');

const container = svg.append('g');

const linkLayer = container
  .append('g')
  .attr('class', 'links');

const nodeLayer = container
  .append('g')
  .attr('class', 'nodes');

svg.call(
  d3
    .zoom()
    .scaleExtent([0.15, 2])
    .on('zoom', event => {
      container.attr('transform', event.transform);
    })
);

function linkStyle(link, distances) {
  if (!selectedNode) {
    return {
      color: '#999',
      opacity: 0.6,
      width: 2
    };
  }

  const s = link.source;
  const t = link.target;

  const ancestors = distances.ancestors;
  const descendants = distances.descendants;

  /*
   * Ancestors travel:
   *
   * parent/reference -> ... -> selected
   *
   * Direct ancestor:
   *     parent -> selected
   *
   * Indirect ancestor:
   *     grandparent -> parent -> selected
   */

  if (
    ancestors[s] === 1 &&
    t === selectedNode.id
  ) {
    return {
      color: '#e53935',
      opacity: 1,
      width: 4
    };
  }

  if (
    ancestors[s] !== undefined &&
    ancestors[t] !== undefined
  ) {
    return {
      color: '#fb8c00',
      opacity: 1,
      width: 3
    };
  }

  /*
   * Descendants travel:
   *
   * selected -> ... -> descendant
   */

  if (
    s === selectedNode.id &&
    descendants[t] === 1
  ) {
    return {
      color: '#1976d2',
      opacity: 1,
      width: 4
    };
  }

  if (
    descendants[s] !== undefined &&
    descendants[t] !== undefined
  ) {
    return {
      color: '#43a047',
      opacity: 1,
      width: 3
    };
  }

  return {
    color: '#ddd',
    opacity: 0.12,
    width: 1
  };
}

function edgePoint(node, target) {
  const cx = node.x + NODE_WIDTH / 2;
  const cy = node.y + node.renderHeight / 2;

  const tx = target.x + NODE_WIDTH / 2;
  const ty = target.y + target.renderHeight / 2;

  const dx = tx - cx;
  const dy = ty - cy;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0
      ? {
          x: node.x + NODE_WIDTH,
          y: cy
        }
      : {
          x: node.x,
          y: cy
        };
  }

  return dy > 0
    ? {
        x: cx,
        y: node.y + node.renderHeight
      }
    : {
        x: cx,
        y: node.y
      };
}

function edgePath(source, target) {
  const s = edgePoint(source, target);
  const t = edgePoint(target, source);

  const dx = Math.abs(t.x - s.x);
  const dy = Math.abs(t.y - s.y);

  if (Math.abs(s.x - t.x) < 5) {
    const midY = (s.y + t.y) / 2;

    return `
      M${s.x},${s.y}
      C${s.x},${midY}
       ${t.x},${midY}
       ${t.x},${t.y}
    `;
  }

  if (Math.abs(s.y - t.y) < 5) {
    const midX = (s.x + t.x) / 2;

    return `
      M${s.x},${s.y}
      C${midX},${s.y}
       ${midX},${t.y}
       ${t.x},${t.y}
    `;
  }

  const curve = Math.max(
    50,
    Math.min(150, Math.max(dx, dy) / 2)
  );

  let c1x = s.x;
  let c1y = s.y;
  let c2x = t.x;
  let c2y = t.y;

  if (Math.abs(t.x - s.x) > Math.abs(t.y - s.y)) {
    c1x = s.x + (t.x > s.x ? curve : -curve);
    c2x = t.x + (s.x > t.x ? curve : -curve);
  } else {
    c1y = s.y + (t.y > s.y ? curve : -curve);
    c2y = t.y + (s.y > t.y ? curve : -curve);
  }

  return `
    M${s.x},${s.y}
    C${c1x},${c1y}
     ${c2x},${c2y}
     ${t.x},${t.y}
  `;
}

function updateDemonstrationPanel() {
  const panel = document.querySelector(
    '#demonstration-panel'
  );

  const title = document.querySelector(
    '#demonstration-title'
  );

  const content = document.querySelector(
    '#demonstration-content'
  );

  if (!panel || !title || !content) {
    return;
  }

  if (!selectedNode) {
    panel.hidden = true;
    return;
  }

  panel.hidden = false;
  title.textContent = nodeTitle(selectedNode);
  content.innerHTML = '';

  const demonstrations =
    selectedNode.demonstration || [];

  if (!demonstrations.length) {
    content.textContent =
      'Aucune démonstration.';

    return;
  }

  demonstrations.forEach(
    (demonstration, index) => {
      const div =
        document.createElement('div');

      div.className = 'demonstration';

      if (demonstrations.length > 1) {
        const heading =
          document.createElement('h3');

        heading.textContent =
          `Démonstration ${index + 1}`;

        div.appendChild(heading);
      }

      const p =
        document.createElement('p');

      p.textContent = demonstration;

      div.appendChild(p);
      content.appendChild(div);
    }
  );
}

function render() {
  const nodes = graph.nodes.filter(
    n =>
      enabledTypes.has(n.type) &&
      enabledParts.has(n.part)
  );

  const ids = new Set(
    nodes.map(n => n.id)
  );

  const links = graph.links.filter(
    l =>
      ids.has(l.source) &&
      ids.has(l.target)
  );

  const distances =
    calculateDistances();

  /*
   * Calculate heights before layout.
   * This prevents long texts from overlapping
   * the following row.
   */

  nodes.forEach(n => {
    n.lines = wrapText(n.text);

    n.renderHeight = Math.max(
      100,
      HEADER_HEIGHT +
        Math.max(
          55,
          n.lines.length * LINE_HEIGHT + 20
        )
    );
  });

  /*
   * Each part gets its own horizontal section.
   *
   * Part I
   * ─────────────────────────
   * nodes nodes nodes nodes
   *
   * Part II
   * ─────────────────────────
   * nodes nodes nodes nodes
   */

  const parts = [
    ...new Set(nodes.map(n => n.part))
  ].sort((a, b) => a - b);

  let partY = 40;

  for (const part of parts) {
    const partNodes =
      nodes.filter(n => n.part === part);

    const columns = 8;

    const rowHeights = [];

    for (
      let i = 0;
      i < partNodes.length;
      i++
    ) {
      const row =
        Math.floor(i / columns);

      rowHeights[row] = Math.max(
        rowHeights[row] || 0,
        partNodes[i].renderHeight
      );
    }

    const rowY = [];
    let y = partY;

    for (
      let r = 0;
      r < rowHeights.length;
      r++
    ) {
      rowY[r] = y;

      y +=
        rowHeights[r] +
        ROW_GAP;
    }

    partNodes.forEach((n, i) => {
      const column = i % columns;
      const row = Math.floor(
        i / columns
      );

      n.x =
        40 +
        column *
          (NODE_WIDTH + COLUMN_GAP);

      n.y = rowY[row];
    });

    partY = y + PART_GAP;
  }

  svg.attr(
    'height',
    Math.max(800, partY)
  );

  /*
   * Links
   */

  const linkSel =
    linkLayer
      .selectAll('path')
      .data(
        links,
        d =>
          `${d.source}-${d.target}-${d.type}`
      );

  linkSel.exit().remove();

  const linkEnter =
    linkSel
      .enter()
      .append('path')
      .attr('fill', 'none')
      .attr(
        'marker-end',
        'url(#arrow)'
      );

  const link =
    linkEnter.merge(linkSel);

  link.each(function(l) {
    const source =
      nodeById.get(l.source);

    const target =
      nodeById.get(l.target);

    if (!source || !target) {
      return;
    }

    const style =
      linkStyle(
        l,
        distances
      );

    d3.select(this)
      .attr(
        'd',
        edgePath(source, target)
      )
      .attr(
        'stroke',
        style.color
      )
      .attr(
        'stroke-width',
        style.width
      )
      .attr(
        'opacity',
        style.opacity
      )
      .attr(
        'color',
        style.color
      );
  });

  /*
   * Nodes
   */

  const nodeSel =
    nodeLayer
      .selectAll('g.node')
      .data(
        nodes,
        d => d.id
      );

  nodeSel.exit().remove();

  const enter =
    nodeSel
      .enter()
      .append('g')
      .attr(
        'class',
        'node'
      )
      .style(
        'cursor',
        'pointer'
      );

  enter
    .append('rect')
    .attr(
      'class',
      'background'
    );

  enter
    .append('rect')
    .attr(
      'class',
      'header'
    );

  enter
    .append('text')
    .attr(
      'class',
      'title'
    )
    .attr(
      'font-size',
      14
    )
    .attr(
      'font-weight',
      'bold'
    )
    .attr(
      'fill',
      '#fff'
    );

  enter
    .append('text')
    .attr(
      'class',
      'part'
    )
    .attr(
      'font-size',
      11
    )
    .attr(
      'fill',
      '#fff'
    );

  enter
    .append('text')
    .attr(
      'class',
      'body'
    )
    .attr(
      'font-size',
      12
    )
    .attr(
      'fill',
      '#222'
    );

  enter.on(
    'click',
    (event, d) => {
      event.stopPropagation();

      selectedNode =
        selectedNode?.id === d.id
          ? null
          : d;

      render();
      updateDemonstrationPanel();
    }
  );

  const node =
    enter.merge(nodeSel);

  node.each(function(d) {
    const g =
      d3.select(this);

    let color =
      colors[d.type] || '#555';

    if (selectedNode) {
      if (
        d.id === selectedNode.id
      ) {
        color = '#e53935';
      } else if (
        distances.ancestors[d.id] === 1
      ) {
        color = '#e53935';
      } else if (
        distances.ancestors[d.id] > 1
      ) {
        color = '#fb8c00';
      } else if (
        distances.descendants[d.id] === 1
      ) {
        color = '#1976d2';
      } else if (
        distances.descendants[d.id] > 1
      ) {
        color = '#43a047';
      } else {
        color = '#bbb';
      }
    }

    let opacity = 1;

    if (
      selectedNode &&
      d.id !== selectedNode.id
    ) {
      const connected =
        distances.ancestors[d.id] !==
          undefined ||
        distances.descendants[d.id] !==
          undefined;

      opacity = connected
        ? 1
        : 0.25;
    }

    g.attr(
      'transform',
      `translate(${d.x},${d.y})`
    ).attr(
      'opacity',
      opacity
    );

    g.select('.background')
      .attr(
        'width',
        NODE_WIDTH
      )
      .attr(
        'height',
        d.renderHeight
      )
      .attr(
        'rx',
        5
      )
      .attr(
        'fill',
        '#fff'
      )
      .attr(
        'stroke',
        color
      )
      .attr(
        'stroke-width',
        2
      );

    g.select('.header')
      .attr(
        'width',
        NODE_WIDTH
      )
      .attr(
        'height',
        HEADER_HEIGHT
      )
      .attr(
        'rx',
        5
      )
      .attr(
        'fill',
        color
      );

    g.select('.title')
      .attr(
        'x',
        10
      )
      .attr(
        'y',
        21
      )
      .text(
        nodeTitle(d)
      );

    const roman =
      ['I', 'II', 'III', 'IV', 'V'][
        d.part - 1
      ] || d.part;

    g.select('.part')
      .attr(
        'x',
        10
      )
      .attr(
        'y',
        43
      )
      .text(
        `Partie ${roman}`
      );

    const body =
      g.select('.body')
        .attr(
          'x',
          10
        )
        .attr(
          'y',
          HEADER_HEIGHT + 18
        );

    body
      .selectAll('tspan')
      .remove();

    d.lines.forEach(
      (line, i) => {
        body
          .append('tspan')
          .attr(
            'x',
            10
          )
          .attr(
            'dy',
            i
              ? LINE_HEIGHT
              : 0
          )
          .text(line);
      }
    );

    let tooltip =
      `${nodeTitle(d)}\nPartie ${roman}`;

    if (d.text) {
      tooltip += `\n\n${d.text}`;
    }

    g.select('title')
      .text(tooltip);
  });
}

/*
 * Type filters
 */

document
  .querySelectorAll(
    '#controls input[data-type]'
  )
  .forEach(input => {
    input.addEventListener(
      'change',
      () => {
        input.checked
          ? enabledTypes.add(
              input.dataset.type
            )
          : enabledTypes.delete(
              input.dataset.type
            );

        selectedNode = null;

        render();
        updateDemonstrationPanel();
      }
    );
  });

/*
 * Part filters
 */

document
  .querySelectorAll(
    '#controls input[data-part]'
  )
  .forEach(input => {
    input.addEventListener(
      'change',
      () => {
        const part =
          Number(input.dataset.part);

        input.checked
          ? enabledParts.add(part)
          : enabledParts.delete(part);

        selectedNode = null;

        render();
        updateDemonstrationPanel();
      }
    );
  });

/*
 * Show / hide all types
 */

document
  .querySelector('#show-none')
  ?.addEventListener(
    'click',
    () => {
      enabledTypes.clear();

      document
        .querySelectorAll(
          '#controls input[data-type]'
        )
        .forEach(
          input =>
            (input.checked = false)
        );

      selectedNode = null;

      render();
      updateDemonstrationPanel();
    }
  );

document
  .querySelector('#show-all')
  ?.addEventListener(
    'click',
    () => {
      document
        .querySelectorAll(
          '#controls input[data-type]'
        )
        .forEach(input => {
          input.checked = true;
          enabledTypes.add(
            input.dataset.type
          );
        });

      selectedNode = null;

      render();
      updateDemonstrationPanel();
    }
  );

/*
 * Show / hide all parts
 */

document
  .querySelector('#parts-none')
  ?.addEventListener(
    'click',
    () => {
      enabledParts.clear();

      document
        .querySelectorAll(
          '#controls input[data-part]'
        )
        .forEach(
          input =>
            (input.checked = false)
        );

      selectedNode = null;

      render();
      updateDemonstrationPanel();
    }
  );

document
  .querySelector('#parts-all')
  ?.addEventListener(
    'click',
    () => {
      [1, 2, 3, 4, 5].forEach(
        p => enabledParts.add(p)
      );

      document
        .querySelectorAll(
          '#controls input[data-part]'
        )
        .forEach(
          input =>
            (input.checked = true)
        );

      selectedNode = null;

      render();
      updateDemonstrationPanel();
    }
  );

/*
 * Click background to deselect
 */

svg.on('click', () => {
  if (selectedNode) {
    selectedNode = null;

    render();
    updateDemonstrationPanel();
  }
});

render();
updateDemonstrationPanel();
