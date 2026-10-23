/** `%term%` with LIKE wildcards escaped, so user input is matched literally. */
export const likeTerm = (term: string): string => `%${term.trim().replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
