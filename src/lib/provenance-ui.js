export function renderProvenanceBadges(
  element,
  descriptor,
  label,
  documentRef = document
) {
  const badges = descriptor?.badges ?? [];

  element.hidden = badges.length === 0;

  if (badges.length === 0) {
    element.replaceChildren();
    return;
  }

  const srLabel = documentRef.createElement("span");

  srLabel.className = "sr-only";
  srLabel.textContent = `${label}: `;

  element.replaceChildren(
    srLabel,
    ...badges.map((badge) => {
      const badgeElement = documentRef.createElement("span");

      badgeElement.className = `provenance-badge provenance-badge--${badge.tone}`;
      badgeElement.setAttribute("aria-label", badge.ariaLabel ?? badge.label);
      badgeElement.textContent = badge.label;
      return badgeElement;
    })
  );
}

export function setClusterState(cluster, descriptor) {
  const badges = descriptor?.badges ?? [];
  const tones = new Set(badges.map((badge) => badge.tone));

  cluster.classList.toggle("field-cluster--entered", tones.has("entered"));
  cluster.classList.toggle("field-cluster--locked", tones.has("locked"));
}
