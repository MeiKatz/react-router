import pathToRegexp from "path-to-regexp";

function isAbsolute(pathname) {
  return pathname.charAt(0) === "/";
}

function ensureTrailingSlash(pathname) {
  return hasTrailingSlash(pathname) ? pathname : pathname + "/";
}

function hasTrailingSlash(pathname) {
  return pathname.charAt(pathname.length - 1) === "/";
}

function resolvePath(pathname, base) {
  if (pathname === undefined || isAbsolute(pathname)) {
    return pathname;
  }

  if (pathname.charAt(0) === ".") {
    switch (pathname.charAt(1)) {
      // pathname points to previous segment (../)
      case ".":
        throw new Error("cannot resolve pathname with leading dot-dot");
      // pathname points to current segment (./)
      case "/":
        pathname = pathname.substr(2);
    }
  }

  if (!base) {
    base = "/";
  }

  if (pathname === "") {
    return base;
  } else {
    return `${ensureTrailingSlash(base)}${pathname}`;
  }
}

const cache = {};
const cacheLimit = 10000;
let cacheCount = 0;

function compilePath(path, options) {
  const cacheKey = `${options.end}${options.strict}${options.sensitive}`;
  const pathCache = cache[cacheKey] || (cache[cacheKey] = {});

  if (pathCache[path]) return pathCache[path];

  const keys = [];
  const regexp = pathToRegexp(path, keys, options);
  const result = { regexp, keys };

  if (cacheCount < cacheLimit) {
    pathCache[path] = result;
    cacheCount++;
  }

  return result;
}

/**
 * Public API for matching a URL pathname to a path.
 */
function matchPath(pathname, options = {}, parent) {
  if (typeof options === "string") {
    options = { path: options };
  }

  const { path, exact = false, strict = false, sensitive = false } = options;

  if (path == null) {
    return parent;
  }

  const paths = [].concat(path);

  return paths.reduce((matched, path) => {
    if (matched) {
      return matched;
    }

    const absolute = isAbsolute(path);

    if (!absolute) {
      path = resolvePath(path, parent && parent.url);
    }

    const { regexp, keys } = compilePath(path, {
      end: exact,
      strict,
      sensitive
    });
    const match = regexp.exec(pathname);

    if (!match) {
      return null;
    }

    const [url, ...values] = match;
    const isExact = pathname === url;

    if (exact && !isExact) {
      return null;
    }

    const matchParams = keys.reduce((params, key, index) => {
      params[key.name] = values[index];
      return params;
    }, {});

    const parentParams = (parent && parent.params) || {};

    const params = absolute ? matchParams : { ...parentParams, ...matchParams };

    return {
      path, // the path pattern used to match
      url: path === "/" && url === "" ? "/" : url, // the matched portion of the URL
      isExact, // whether or not we matched exactly
      params
    };
  }, null);
}

export default matchPath;
