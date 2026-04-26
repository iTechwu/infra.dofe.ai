import arrayUtil from './array.util';
import stringUtil from './string.util';

export default {
  ensurePrefixEndsWithSlash(prefix: string): string {
    if (!prefix.endsWith('/')) {
      prefix += '/';
    }
    return prefix;
  },
};
