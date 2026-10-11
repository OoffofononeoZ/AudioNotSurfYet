import path from 'node:path';
import { areaOf, byText, readText } from './repository.mjs';

// Limited file-level import inspection, not a compiler or a runtime call graph.
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue'];

function resolveJavascript(specifier, file, known) {
  let base;
  if (specifier.startsWith('.')) base = path.posix.join(path.posix.dirname(file), specifier);
  else if (specifier.startsWith('@/')) base = `src/${specifier.slice(2)}`;
  else return null;
  const bases = [base];
  if (/\.[cm]?js$/.test(base)) bases.push(base.replace(/\.[cm]?js$/, ''));
  for (const candidate of bases) {
    for (const suffix of ['', ...EXTENSIONS, ...EXTENSIONS.map(ext => `/index${ext}`)]) {
      const target = path.posix.normalize(candidate + suffix);
      if (known.has(target)) return target;
    }
  }
  return null;
}

function javascriptImports(text, file, known) {
  if (file.endsWith('.vue')) {
    text = [...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]).join('\n');
  }
  text = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const patterns = [
    /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?(?:[\w$]+\s*,?\s*)?(?:\{[^}]*\}|\*(?:\s+as\s+[\w$]+)?)?\s*from\s*['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g,
    /\b(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  return patterns.flatMap(pattern => [...text.matchAll(pattern)]
    .map(match => resolveJavascript(match[1], file, known)).filter(Boolean));
}

export function inspectSources(root, files) {
  const sources = files.filter(file => areaOf(file));
  const known = new Set(sources);
  return sources.map(file => {
    const text = readText(root, file);
    const imports = file.endsWith('.ps1') ? [] : javascriptImports(text, file, known);
    return { file, area: areaOf(file), imports: [...new Set(imports)].sort(byText) };
  });
}
