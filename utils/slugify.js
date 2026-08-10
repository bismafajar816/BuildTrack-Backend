function slugify(name) {
  return (
    (name || "misc")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "misc"
  );
}

module.exports = { slugify };