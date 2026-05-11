export default {
  add(num1: bigint | number, num2: bigint | number): bigint {
    return BigInt(num1) + BigInt(num2);
  },

  des(num1: bigint | number, num2: bigint | number): bigint {
    return BigInt(num1) - BigInt(num2);
  },

  /** @deprecated Use Number(bigint) directly if you must convert. This loses precision for values > Number.MAX_SAFE_INTEGER. */
  parseToInt(num: bigint): number {
    return Number(num);
  },

  gt(num1: bigint | number, num2: bigint | number): boolean {
    return BigInt(num1) > BigInt(num2);
  },

  serialize(obj: any, seen = new WeakSet()): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'object' && seen.has(obj)) {
      return '[Circular]';
    }

    switch (typeof obj) {
      case 'bigint':
        return obj.toString();
      case 'object':
        if (obj instanceof Date) {
          return obj;
        }
        if (Array.isArray(obj)) {
          seen.add(obj);
          const result = obj.map((value) => this.serialize(value, seen));
          seen.delete(obj);
          return result;
        }
        seen.add(obj);
        const result = Object.fromEntries(
          Object.entries(obj).map(([key, value]) => [
            key,
            this.serialize(value, seen),
          ]),
        );
        seen.delete(obj);
        return result;
      default:
        return obj;
    }
  },
};
