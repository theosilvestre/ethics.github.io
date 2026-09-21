import * as d3 from 'd3';
import data from '../data.js';

/*
 * ============================================================
 * COLORS
 * ============================================================
 */

const colors = {
  proposition: '#4a90e2',
  corollary: '#f39c12',
  scolie: '#9b59b6',
  definition: '#27ae60',
  lemma: '#e74c3c',
  axiom: '#34495e',
  postulate: '#16a085',

  preambule: '#7f8c8d',
  preface: '#7f8c8d',
  appendix: '#7f8c8d',
  chapter: '#7f8c8d'
};


/*
 * ============================================================
 * LAYOUT CONSTANTS
 * ============================================================
 */

const NODE_WIDTH = 300;
const HEADER_HEIGHT = 58;
const LINE_HEIGHT = 16;

const COLUMN_GAP = 100;
const ROW_GAP = 55;
const PART_GAP = 120;

const DESKTOP_COLUMNS = 8;
const MOBILE_COLUMNS = 2;


/*
 * ============================================================
 * TYPE FAMILIES
 *
 * Different concrete types belong to the same filter/color
 * family.
 *
 * axiom
 * axiom_on_bodies
 * axiom_on_interactions_of_bodies
 *
 * all behave as "axiom".
 *
 * Same for definitions.
 * ============================================================
 */

const TYPE_FAMILIES = {
  axiom: 'axiom',
  axiom_on_bodies: 'axiom',
  axiom_on_interactions_of_bodies: 'axiom',

  definition: 'definition',
  definition_affects_general: 'definition',
  definition_affects: 'definition',
  definition_individual: 'definition'
};

function typeFamily(type) {
  return TYPE_FAMILIES[type] || type;
}


/*
 * ============================================================
 * NODE TITLES
 * ============================================================
 */

const NODE_NAMES = {
  proposition: 'Proposition',
  corollary: 'Corollaire',
  scolie: 'Scolie',
  definition: 'Définition',
  lemma: 'Lemme',
  axiom: 'Axiome',
  postulate: 'Postulat',

  preambule: 'Préambule',
  preface: 'Préface',
  appendix: 'Appendice',
  chapter: 'Chapitre',

  axiom_on_interactions_of_bodies:
    'Axiome sur rapports entre corps',

  axiom_on_bodies:
    'Axiome sur les corps',

  definition_affects_general:
    'Définition générale des affects',

  definition_affects:
    'Définition des affects',

  definition_individual:
    "Définition de l'individu"
};

function nodeTitle(n) {
  const name = NODE_NAMES[n.type] || n.type;

  /*
   * Structural nodes such as the preamble don't have numbers.
   */
  if (
    n.number === undefined ||
    n.number === null
  ) {
    return name;
  }

  let title = `${name} ${n.number}`;

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


/*
 * ============================================================
 * DEVICE
 * ============================================================
 */

const isMobile =
  window.matchMedia('(max-width: 768px)').matches;

const COLUMNS =
  isMobile
    ? MOBILE_COLUMNS
    : DESKTOP_COLUMNS;


/*
 * ============================================================
 * ENABLED FILTERS
 * ============================================================
 */

const enabledTypes = new Set([
  'proposition',
  'corollary',
  'scolie',
  'definition',
  'lemma',
  'axiom',
  'postulate',
  'preambule',
  'preface',
  'appendix',
  'chapter',

  'axiom_on_interactions_of_bodies',
  'axiom_on_bodies',

  'definition_affects_general',
  'definition_affects',
  'definition_individual'
]);

const enabledParts = new Set(
  isMobile
    ? [2]
    : [1, 2, 3, 4, 5]
);

let selectedNode = null;


/*
 * ============================================================
 * NODE IDS
 * ============================================================
 */

function nodeId(n) {
  const parent = n.parent
    ? `:${n.parent.type}:${n.parent.number}`
    : '';

  return `${n.type}:${n.number}:${n.part}${parent}`;
}


/*
 * ============================================================
 * TEXT WRAPPING
 *
 * Cached permanently on the node.
 * ============================================================
 */

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

      for (
        let i = 0;
        i < word.length;
        i += max
      ) {
        lines.push(
          word.slice(i, i + max)
        );
      }

      continue;
    }

    const candidate = line
      ? `${line} ${word}`
      : word;

    if (
      candidate.length > max &&
      line
    ) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines;
}


/*
 * ============================================================
 * GRAPH CONSTRUCTION
 * ============================================================
 */

function buildGraph(data) {
  const nodes = [];
  const links = [];

  const map = new Map();

  function add(n, placeholder = false) {
    const id = nodeId(n);

    const existing = map.get(id);

    if (!existing) {
      const node = {
        id,
        type: n.type,
        number: n.number,
        part: n.part,

        text: n.text || '',

        demonstration:
          n.demonstration || [],

        references:
          n.references || [],

        parent:
          n.parent,

        placeholder,

        /*
         * CACHE STATIC VALUES
         */
        family:
          typeFamily(n.type),

        title:
          nodeTitle(n),

        lines:
          wrapText(n.text || ''),

        renderHeight:
          100
      };

      node.renderHeight =
        Math.max(
          100,
          HEADER_HEIGHT +
            Math.max(
              55,
              node.lines.length *
                LINE_HEIGHT +
                20
            )
        );

      map.set(id, node);
      nodes.push(node);

      return id;
    }

    /*
     * Replace placeholder with real node.
     */
    if (!placeholder) {
      existing.type = n.type;
      existing.number = n.number;
      existing.part = n.part;
      existing.text = n.text || '';
      existing.demonstration =
        n.demonstration || [];
      existing.references =
        n.references || [];
      existing.parent =
        n.parent;

      existing.placeholder = false;

      existing.family =
        typeFamily(n.type);

      existing.title =
        nodeTitle(n);

      existing.lines =
        wrapText(n.text || '');

      existing.renderHeight =
        Math.max(
          100,
          HEADER_HEIGHT +
            Math.max(
              55,
              existing.lines.length *
                LINE_HEIGHT +
                20
            )
        );
    }

    return id;
  }

  for (const item of data) {
    const source = add(item);

    /*
     * REFERENCES
     */
    for (const ref of item.references || []) {
      const referenced = add(
        {
          type: ref.type,
          number: ref.number,
          part:
            ref.part ?? item.part,
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

    /*
     * PARENT
     */
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

  return {
    nodes,
    links
  };
}

const graph =
  buildGraph(data);

const nodeById =
  new Map(
    graph.nodes.map(
      n => [n.id, n]
    )
  );


/*
 * ============================================================
 * PRE-COMPUTE GRAPH ADJACENCY
 *
 * This is a major performance improvement.
 *
 * Previously calculateDistances() rebuilt these Maps on every
 * render.
 * ============================================================
 */

const incoming = new Map();
const outgoing = new Map();

for (const link of graph.links) {
  if (!incoming.has(link.target)) {
    incoming.set(
      link.target,
      []
    );
  }

  if (!outgoing.has(link.source)) {
    outgoing.set(
      link.source,
      []
    );
  }

  incoming
    .get(link.target)
    .push(link.source);

  outgoing
    .get(link.source)
    .push(link.target);
}


/*
 * ============================================================
 * DISTANCE CACHE
 * ============================================================
 */

const distanceCache =
  new Map();

function walk(start, adjacency) {
  const distances = new Map();

  distances.set(start, 0);

  /*
   * Using an index instead of queue.shift().
   *
   * queue.shift() moves all remaining elements.
   */
  const queue = [start];

  let index = 0;

  while (index < queue.length) {
    const current =
      queue[index++];

    const currentDistance =
      distances.get(current);

    const nextNodes =
      adjacency.get(current);

    if (!nextNodes) {
      continue;
    }

    for (
      const next of nextNodes
    ) {
      if (
        !distances.has(next)
      ) {
        distances.set(
          next,
          currentDistance + 1
        );

        queue.push(next);
      }
    }
  }

  return distances;
}

function calculateDistances() {
  if (!selectedNode) {
    return {
      ancestors: new Map(),
      descendants: new Map()
    };
  }

  const cached =
    distanceCache.get(
      selectedNode.id
    );

  if (cached) {
    return cached;
  }

  const result = {
    ancestors:
      walk(
        selectedNode.id,
        incoming
      ),

    descendants:
      walk(
        selectedNode.id,
        outgoing
      )
  };

  distanceCache.set(
    selectedNode.id,
    result
  );

  return result;
}


/*
 * ============================================================
 * SVG
 * ============================================================
 */

const svg =
  d3
    .select('#graph')
    .append('svg')
    .attr(
      'width',
      1800
    );

const defs =
  svg.append('defs');

defs
  .append('marker')
  .attr(
    'id',
    'arrow'
  )
  .attr(
    'viewBox',
    '0 -5 10 10'
  )
  .attr(
    'refX',
    9
  )
  .attr(
    'refY',
    0
  )
  .attr(
    'markerWidth',
    7
  )
  .attr(
    'markerHeight',
    7
  )
  .attr(
    'orient',
    'auto'
  )
  .append('path')
  .attr(
    'd',
    'M0,-5L10,0L0,5'
  )
  .attr(
    'fill',
    'currentColor'
  );

const container =
  svg
    .append('g');

const linkLayer =
  container
    .append('g')
    .attr(
      'class',
      'links'
    );

const nodeLayer =
  container
    .append('g')
    .attr(
      'class',
      'nodes'
    );


/*
 * ============================================================
 * ZOOM
 *
 * Keep zoom lightweight.
 * ============================================================
 */

const zoom =
  d3
    .zoom()
    .scaleExtent([
      0.15,
      2
    ])
    .on(
      'zoom',
      event => {
        container.attr(
          'transform',
          event.transform
        );
      }
    );

svg.call(zoom);


/*
 * ============================================================
 * EDGE GEOMETRY
 * ============================================================
 */

function edgePoint(
  node,
  target
) {
  const cx =
    node.x +
    NODE_WIDTH / 2;

  const cy =
    node.y +
    node.renderHeight / 2;

  const tx =
    target.x +
    NODE_WIDTH / 2;

  const ty =
    target.y +
    target.renderHeight / 2;

  const dx =
    tx - cx;

  const dy =
    ty - cy;

  if (
    Math.abs(dx) >
    Math.abs(dy)
  ) {
    return dx > 0
      ? {
          x:
            node.x +
            NODE_WIDTH,
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
        y:
          node.y +
          node.renderHeight
      }
    : {
        x: cx,
        y: node.y
      };
}

function edgePath(
  source,
  target
) {
  const s =
    edgePoint(
      source,
      target
    );

  const t =
    edgePoint(
      target,
      source
    );

  const dx =
    Math.abs(
      t.x - s.x
    );

  const dy =
    Math.abs(
      t.y - s.y
    );

  if (
    Math.abs(
      s.x - t.x
    ) < 5
  ) {
    const midY =
      (s.y + t.y) / 2;

    return `
      M${s.x},${s.y}
      C${s.x},${midY}
       ${t.x},${midY}
       ${t.x},${t.y}
    `;
  }

  if (
    Math.abs(
      s.y - t.y
    ) < 5
  ) {
    const midX =
      (s.x + t.x) / 2;

    return `
      M${s.x},${s.y}
      C${midX},${s.y}
       ${midX},${t.y}
       ${t.x},${t.y}
    `;
  }

  const curve =
    Math.max(
      50,
      Math.min(
        150,
        Math.max(
          dx,
          dy
        ) / 2
      )
    );

  let c1x = s.x;
  let c1y = s.y;
  let c2x = t.x;
  let c2y = t.y;

  if (
    Math.abs(
      t.x - s.x
    ) >
    Math.abs(
      t.y - s.y
    )
  ) {
    c1x =
      s.x +
      (
        t.x > s.x
          ? curve
          : -curve
      );

    c2x =
      t.x +
      (
        s.x > t.x
          ? curve
          : -curve
      );
  } else {
    c1y =
      s.y +
      (
        t.y > s.y
          ? curve
          : -curve
      );

    c2y =
      t.y +
      (
        s.y > t.y
          ? curve
          : -curve
      );
  }

  return `
    M${s.x},${s.y}
    C${c1x},${c1y}
     ${c2x},${c2y}
     ${t.x},${t.y}
  `;
}


/*
 * ============================================================
 * LINK STYLE
 * ============================================================
 */

function linkStyle(
  link,
  distances
) {
  if (!selectedNode) {
    return {
      color: '#999',
      opacity: 0.6,
      width: 2
    };
  }

  const s =
    link.source;

  const t =
    link.target;

  const ancestors =
    distances.ancestors;

  const descendants =
    distances.descendants;

  /*
   * Direct ancestor
   */
  if (
    ancestors.get(s) === 1 &&
    t === selectedNode.id
  ) {
    return {
      color: '#e53935',
      opacity: 1,
      width: 4
    };
  }

  /*
   * Indirect ancestor
   */
  if (
    ancestors.has(s) &&
    ancestors.has(t)
  ) {
    return {
      color: '#fb8c00',
      opacity: 1,
      width: 3
    };
  }

  /*
   * Direct descendant
   */
  if (
    s === selectedNode.id &&
    descendants.get(t) === 1
  ) {
    return {
      color: '#1976d2',
      opacity: 1,
      width: 4
    };
  }

  /*
   * Indirect descendant
   */
  if (
    descendants.has(s) &&
    descendants.has(t)
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


/*
 * ============================================================
 * DEMONSTRATION PANEL
 * ============================================================
 */

const demonstrationPanel =
  document.querySelector(
    '#demonstration-panel'
  );

const demonstrationTitle =
  document.querySelector(
    '#demonstration-title'
  );

const demonstrationContent =
  document.querySelector(
    '#demonstration-content'
  );

function updateDemonstrationPanel() {
  if (
    !demonstrationPanel ||
    !demonstrationTitle ||
    !demonstrationContent
  ) {
    return;
  }

  if (!selectedNode) {
    demonstrationPanel.hidden =
      true;

    return;
  }

  demonstrationPanel.hidden =
    false;

  demonstrationTitle.textContent =
    selectedNode.title;

  demonstrationContent.innerHTML =
    '';

  const demonstrations =
    selectedNode.demonstration ||
    [];

  if (
    !demonstrations.length
  ) {
    demonstrationContent.textContent =
      'Aucune démonstration.';

    return;
  }

  const fragment =
    document.createDocumentFragment();

  demonstrations.forEach(
    (
      demonstration,
      index
    ) => {
      const div =
        document.createElement(
          'div'
        );

      div.className =
        'demonstration';

      if (
        demonstrations.length > 1
      ) {
        const heading =
          document.createElement(
            'h3'
          );

        heading.textContent =
          `Démonstration ${index + 1}`;

        div.appendChild(
          heading
        );
      }

      const p =
        document.createElement(
          'p'
        );

      p.textContent =
        demonstration;

      div.appendChild(p);

      fragment.appendChild(
        div
      );
    }
  );

  demonstrationContent.appendChild(
    fragment
  );
}


/*
 * ============================================================
 * FILTERED GRAPH CACHE
 * ============================================================
 *
 * The current visible node/link set is cached.
 *
 * It is invalidated only when filters change.
 * ============================================================
 */

let visibleNodes = [];
let visibleLinks = [];

let filterDirty = true;

function rebuildVisibleGraph() {
  if (!filterDirty) {
    return;
  }

  visibleNodes = [];
  visibleLinks = [];

  /*
   * Avoid graph.nodes.filter() + Set creation where possible.
   */
  const visibleIds =
    new Set();

  for (
    const node of graph.nodes
  ) {
    if (
      enabledParts.has(
        node.part
      ) &&
      enabledTypes.has(
        node.family
      )
    ) {
      visibleNodes.push(node);
      visibleIds.add(node.id);
    }
  }

  for (
    const link of graph.links
  ) {
    if (
      visibleIds.has(
        link.source
      ) &&
      visibleIds.has(
        link.target
      )
    ) {
      visibleLinks.push(link);
    }
  }

  filterDirty = false;
}


/*
 * ============================================================
 * LAYOUT
 * ============================================================
 */

function calculateLayout() {
  const parts =
    new Map();

  /*
   * Group nodes by part once.
   */
  for (
    const node of visibleNodes
  ) {
    if (!parts.has(node.part)) {
      parts.set(
        node.part,
        []
      );
    }

    parts
      .get(node.part)
      .push(node);
  }

  const sortedParts =
    [...parts.keys()]
      .sort(
        (a, b) => a - b
      );

  let partY = 40;

  for (
    const part of sortedParts
  ) {
    const partNodes =
      parts.get(part);

    const rowHeights = [];

    /*
     * Calculate row heights.
     */
    for (
      let i = 0;
      i < partNodes.length;
      i++
    ) {
      const row =
        Math.floor(
          i / COLUMNS
        );

      const height =
        partNodes[i]
          .renderHeight;

      rowHeights[row] =
        Math.max(
          rowHeights[row] || 0,
          height
        );
    }

    const rowY = [];

    let y = partY;

    for (
      let row = 0;
      row < rowHeights.length;
      row++
    ) {
      rowY[row] = y;

      y +=
        rowHeights[row] +
        ROW_GAP;
    }

    /*
     * Position nodes.
     */
    for (
      let i = 0;
      i < partNodes.length;
      i++
    ) {
      const node =
        partNodes[i];

      const column =
        i % COLUMNS;

      const row =
        Math.floor(
          i / COLUMNS
        );

      node.x =
        40 +
        column *
          (
            NODE_WIDTH +
            COLUMN_GAP
          );

      node.y =
        rowY[row];
    }

    partY =
      y + PART_GAP;
  }

  svg.attr(
    'height',
    Math.max(
      800,
      partY
    )
  );
}


/*
 * ============================================================
 * NODE DOM CREATION
 * ============================================================
 */

function createNode(selection) {
  selection
    .append('rect')
    .attr(
      'class',
      'background'
    );

  selection
    .append('rect')
    .attr(
      'class',
      'header'
    );

  selection
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

  selection
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

  selection
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
}


/*
 * ============================================================
 * UPDATE NODE APPEARANCE
 * ============================================================
 */

function nodeColor(
  node,
  distances
) {
  const familyColor =
    colors[node.family] ||
    '#555';

  if (!selectedNode) {
    return familyColor;
  }

  if (
    node.id ===
    selectedNode.id
  ) {
    return '#e53935';
  }

  const ancestorDistance =
    distances.ancestors.get(
      node.id
    );

  if (
    ancestorDistance === 1
  ) {
    return '#e53935';
  }

  if (
    ancestorDistance > 1
  ) {
    return '#fb8c00';
  }

  const descendantDistance =
    distances.descendants.get(
      node.id
    );

  if (
    descendantDistance === 1
  ) {
    return '#1976d2';
  }

  if (
    descendantDistance > 1
  ) {
    return '#43a047';
  }

  return '#bbb';
}

function nodeOpacity(
  node,
  distances
) {
  if (
    !selectedNode ||
    node.id ===
      selectedNode.id
  ) {
    return 1;
  }

  const connected =
    distances.ancestors.has(
      node.id
    ) ||
    distances.descendants.has(
      node.id
    );

  return connected
    ? 1
    : 0.25;
}


/*
 * ============================================================
 * UPDATE NODE
 * ============================================================
 */

function updateNode(
  g,
  node,
  distances
) {
  const color =
    nodeColor(
      node,
      distances
    );

  const opacity =
    nodeOpacity(
      node,
      distances
    );

  g.attr(
    'transform',
    `translate(${node.x},${node.y})`
  );

  g.attr(
    'opacity',
    opacity
  );

  /*
   * Background
   */
  g.select(
    '.background'
  )
    .attr(
      'width',
      NODE_WIDTH
    )
    .attr(
      'height',
      node.renderHeight
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

  /*
   * Header
   */
  g.select(
    '.header'
  )
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

  /*
   * Title
   */
  g.select(
    '.title'
  )
    .attr(
      'x',
      10
    )
    .attr(
      'y',
      21
    )
    .text(
      node.title
    );

  /*
   * Part
   */
  const roman =
    [
      'I',
      'II',
      'III',
      'IV',
      'V'
    ][node.part - 1] ||
    node.part;

  g.select(
    '.part'
  )
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

  /*
   * Body
   *
   * IMPORTANT:
   *
   * We only rebuild tspans when the node is created.
   * The text itself never changes.
   */
}


/*
 * ============================================================
 * CREATE BODY TEXT ONCE
 * ============================================================
 */

function createBodyText(
  g,
  node
) {
  const body =
    g.select(
      '.body'
    )
    .attr(
      'x',
      10
    )
    .attr(
      'y',
      HEADER_HEIGHT + 18
    );

  /*
   * Build all tspans only once.
   */
  const fragment =
    document.createDocumentFragment();

  /*
   * D3 cannot directly append a DOM
   * fragment to the SVG selection in
   * the same way, so use normal D3 here.
   *
   * This runs only when a node is first created.
   */
  node.lines.forEach(
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

  /*
   * Tooltip
   */
  let tooltip =
    `${node.title}\nPartie ${node.part}`;

  if (node.text) {
    tooltip +=
      `\n\n${node.text}`;
  }

  g.append('title')
    .text(
      tooltip
    );
}


/*
 * ============================================================
 * RENDER LINKS
 * ============================================================
 */

function renderLinks(
  distances
) {
  const linkSel =
    linkLayer
      .selectAll(
        'path'
      )
      .data(
        visibleLinks,
        d =>
          `${d.source}-${d.target}-${d.type}`
      );

  linkSel
    .exit()
    .remove();

  const linkEnter =
    linkSel
      .enter()
      .append('path')
      .attr(
        'fill',
        'none'
      )
      .attr(
        'marker-end',
        'url(#arrow)'
      );

  const link =
    linkEnter.merge(
      linkSel
    );

  link.each(
    function(l) {
      const source =
        nodeById.get(
          l.source
        );

      const target =
        nodeById.get(
          l.target
        );

      if (
        !source ||
        !target
      ) {
        return;
      }

      const style =
        linkStyle(
          l,
          distances
        );

      const element =
        d3.select(
          this
        );

      element
        .attr(
          'd',
          edgePath(
            source,
            target
          )
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
    }
  );
}


/*
 * ============================================================
 * RENDER NODES
 * ============================================================
 */

function renderNodes(
  distances
) {
  const nodeSel =
    nodeLayer
      .selectAll(
        'g.node'
      )
      .data(
        visibleNodes,
        d => d.id
      );

  nodeSel
    .exit()
    .remove();

  const nodeEnter =
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

  /*
   * Build static DOM only once.
   */
  createNode(
    nodeEnter
  );

  /*
   * Build text only once.
   */
  nodeEnter.each(
    function(d) {
      createBodyText(
        d3.select(this),
        d
      );
    }
  );

  /*
   * Click handler only once.
   */
  nodeEnter.on(
    'click',
    (
      event,
      d
    ) => {
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
    nodeEnter.merge(
      nodeSel
    );

  /*
   * Update only dynamic properties.
   */
  node.each(
    function(d) {
      updateNode(
        d3.select(this),
        d,
        distances
      );
    }
  );
}


/*
 * ============================================================
 * MAIN RENDER
 * ============================================================
 */

let rendering = false;

function render() {
  /*
   * Prevent accidental recursive renders.
   */
  if (rendering) {
    return;
  }

  rendering = true;

  rebuildVisibleGraph();

  calculateLayout();

  const distances =
    calculateDistances();

  renderLinks(
    distances
  );

  renderNodes(
    distances
  );

  rendering = false;
}


/*
 * ============================================================
 * RESET SELECTION
 * ============================================================
 */

function resetSelection() {
  selectedNode = null;

  render();
  updateDemonstrationPanel();
}


/*
 * ============================================================
 * TYPE FILTERS
 * ============================================================
 */

document
  .querySelectorAll(
    '#controls input[data-type]'
  )
  .forEach(
    input => {
      input.addEventListener(
        'change',
        () => {
          const family =
            typeFamily(
              input.dataset.type
            );

          if (
            input.checked
          ) {
            enabledTypes.add(
              family
            );
          } else {
            enabledTypes.delete(
              family
            );
          }

          filterDirty = true;

          resetSelection();
        }
      );
    }
  );


/*
 * ============================================================
 * PART FILTERS
 * ============================================================
 */

document
  .querySelectorAll(
    '#controls input[data-part]'
  )
  .forEach(
    input => {
      input.addEventListener(
        'change',
        () => {
          const part =
            Number(
              input.dataset.part
            );

          if (
            input.checked
          ) {
            enabledParts.add(
              part
            );
          } else {
            enabledParts.delete(
              part
            );
          }

          filterDirty = true;

          resetSelection();
        }
      );
    }
  );


/*
 * ============================================================
 * SHOW / HIDE ALL TYPES
 * ============================================================
 */

document
  .querySelector(
    '#show-none'
  )
  ?.addEventListener(
    'click',
    () => {
      enabledTypes.clear();

      document
        .querySelectorAll(
          '#controls input[data-type]'
        )
        .forEach(
          input => {
            input.checked =
              false;
          }
        );

      filterDirty = true;

      resetSelection();
    }
  );

document
  .querySelector(
    '#show-all'
  )
  ?.addEventListener(
    'click',
    () => {
      /*
       * Add families, not concrete
       * subtypes.
       */
      enabledTypes.clear();

      document
        .querySelectorAll(
          '#controls input[data-type]'
        )
        .forEach(
          input => {
            input.checked =
              true;

            enabledTypes.add(
              typeFamily(
                input.dataset.type
              )
            );
          }
        );

      filterDirty = true;

      resetSelection();
    }
  );


/*
 * ============================================================
 * SHOW / HIDE ALL PARTS
 * ============================================================
 */

document
  .querySelector(
    '#parts-none'
  )
  ?.addEventListener(
    'click',
    () => {
      enabledParts.clear();

      document
        .querySelectorAll(
          '#controls input[data-part]'
        )
        .forEach(
          input => {
            input.checked =
              false;
          }
        );

      filterDirty = true;

      resetSelection();
    }
  );

document
  .querySelector(
    '#parts-all'
  )
  ?.addEventListener(
    'click',
    () => {
      enabledParts.clear();

      for (
        let p = 1;
        p <= 5;
        p++
      ) {
        enabledParts.add(p);
      }

      document
        .querySelectorAll(
          '#controls input[data-part]'
        )
        .forEach(
          input => {
            input.checked =
              true;
          }
        );

      filterDirty = true;

      resetSelection();
    }
  );


/*
 * ============================================================
 * CLICK BACKGROUND
 * ============================================================
 */

svg.on(
  'click',
  () => {
    if (selectedNode) {
      resetSelection();
    }
  }
);


/*
 * ============================================================
 * INITIAL RENDER
 * ============================================================
 */

render();
updateDemonstrationPanel();
