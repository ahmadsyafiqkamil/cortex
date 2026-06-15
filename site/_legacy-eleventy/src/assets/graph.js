document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("graph-container");
  const loading = document.getElementById("graph-loading");
  if (!container) return;

  const linkData = window.__CORTEX_LINKS__ || [];

  const slugs = new Set();
  linkData.forEach(l => { slugs.add(l.from); slugs.add(l.to); });

  const elements = [];
  const systemSlugs = new Set(["_index", "_log"]);

  slugs.forEach(slug => {
    if (systemSlugs.has(slug)) return;
    const label = slug.length > 30 ? slug.slice(0, 28) + ".." : slug;
    elements.push({
      data: { id: slug, label: label, slug: slug },
      classes: "page-node",
    });
  });

  linkData.forEach(l => {
    if (systemSlugs.has(l.from) || systemSlugs.has(l.to)) return;
    elements.push({
      data: {
        id: `${l.from}->${l.to}`,
        source: l.from,
        target: l.to,
      },
      classes: "link-edge",
    });
  });

  if (loading) loading.remove();

  const cy = cytoscape({
    container: container,
    elements: elements,
    style: [
      {
        selector: ".page-node",
        style: {
          "background-color": "#1e40af",
          label: "data(label)",
          color: "#93c5fd",
          "font-size": "10px",
          "text-valign": "center",
          "text-halign": "center",
          "text-wrap": "ellipsis",
          "text-max-width": "120px",
          "border-width": 1,
          "border-color": "#3b82f6",
          width: 24,
          height: 24,
          "font-family": "monospace",
        },
      },
      {
        selector: ".link-edge",
        style: {
          width: 1,
          "line-color": "#374151",
          "curve-style": "bezier",
          "target-arrow-color": "#4b5563",
          "target-arrow-shape": "triangle",
          "arrow-scale": 0.6,
        },
      },
    ],
    layout: {
      name: "cose",
      animate: true,
      animationDuration: 800,
      nodeRepulsion: () => 8000,
      idealEdgeLength: () => 120,
      gravity: 0.3,
      numIter: 2000,
    },
    minZoom: 0.3,
    maxZoom: 3,
  });

  cy.on("tap", "node", (evt) => {
    const slug = evt.target.data("slug");
    if (slug) {
      window.location.href = `/${slug}/index.html`;
    }
  });

  cy.on("mouseover", "node", () => {
    container.style.cursor = "pointer";
  });
  cy.on("mouseout", "node", () => {
    container.style.cursor = "default";
  });

  console.log(`[graph] ${cy.nodes().length} nodes, ${cy.edges().length} edges`);
});
